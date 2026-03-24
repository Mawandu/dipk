import xml.etree.ElementTree as ET
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration - defaults or from env
DB_NAME = os.getenv("DB_NAME", "dipk_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")

OSC_FILE = "changes.osc"

def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def create_table(conn):
    try:
        cur = conn.cursor()
        # Enable PostGIS extension if not exists
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
        
        # Create table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poubelles_officielles (
                id SERIAL PRIMARY KEY,
                osm_id VARCHAR(50) UNIQUE,
                geom GEOMETRY(Point, 4326),
                tags JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # --- NEW TABLES FOR V2 ---
    
        # 1. Users & Roles
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('ADMIN', 'INSPECTEUR', 'SUPERVISEUR', 'AGENT');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role user_role NOT NULL,
                phone VARCHAR(20),
                full_name VARCHAR(100),
                assigned_zone GEOMETRY(Polygon, 4326),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Transit Centers
        cur.execute("""
            CREATE TABLE IF NOT EXISTS centres_transit (
                id SERIAL PRIMARY KEY,
                osm_id BIGINT UNIQUE,
                name VARCHAR(100),
                capacity_max INT DEFAULT 1000,
                current_load INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'OPERATIONAL', -- OPERATIONAL, FULL, EVACUATING
                geom GEOMETRY(Point, 4326)
            );
        """)

        # 3. Landfills (Centres d'Enfouissement)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS centres_enfouissement (
                id SERIAL PRIMARY KEY,
                osm_id BIGINT UNIQUE,
                name VARCHAR(100),
                geom GEOMETRY(Point, 4326)
            );
        """)
        
        # 4. Update Signalements to track flow
        cur.execute("""
            ALTER TABLE signalements 
            ADD COLUMN IF NOT EXISTS assigned_to INT REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS transit_center_id INT REFERENCES centres_transit(id),
            ADD COLUMN IF NOT EXISTS validation_photo_path TEXT,
            ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS validated_by INT REFERENCES users(id);
        """)

        # --- EXISTING TABLES ---
        # Create table for official bins (poubelles_officielles)
        # This re-declaration ensures the schema is up-to-date if it changes,
        # but the initial one above is the primary creation.
        # For osm_id, changing from VARCHAR(50) to BIGINT is a schema migration.
        # If the table already exists with VARCHAR(50), this CREATE TABLE IF NOT EXISTS
        # will not alter it. An explicit ALTER TABLE would be needed for type change.
        # For now, keeping the original VARCHAR(50) as it's already defined.
        # The provided edit has BIGINT, but the original code has VARCHAR(50).
        # I will keep the original VARCHAR(50) for poubelles_officielles to avoid
        # an implicit schema change that might not be intended by the user's instruction
        # which only asked to *add* tables, not modify existing ones unless specified.
        # The provided snippet for poubelles_officielles and signalements seems to be
        # a reference to their structure, not necessarily a command to re-create them
        # with potentially different types if they already exist.
        # I will assume the user wants to keep the original definition for poubelles_officielles
        # and signalements, and only add the new tables and alter signalements.
        # The provided snippet for poubelles_officielles and signalements is redundant
        # if the tables are already created above, and could be misleading if types differ.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS poubelles_officielles (
                id SERIAL PRIMARY KEY,
                osm_id BIGINT UNIQUE,
                tags JSONB,
                geom GEOMETRY(Point, 4326)
            );
        """)

        # Create index for spatial queries
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_poubelles_geom 
            ON poubelles_officielles USING GIST(geom);
        """)

        # Create signalements table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS signalements (
                id SERIAL PRIMARY KEY,
                geom GEOMETRY(Point, 4326),
                image_path TEXT,
                status VARCHAR(50), -- 'ILLEGAL_DUMP' or 'LEGAL_MAINTENANCE'
                status_message TEXT,
                latitude FLOAT, -- Keeping raw coords for easy access if needed
                longitude FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create index for spatial queries on signalements
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_signalements_geom 
            ON signalements USING GIST(geom);
        """)
        
        conn.commit()
        cur.close()
        print("Table 'poubelles_officielles' created successfully.")
    except Exception as e:
        print(f"Error creating table: {e}")
        conn.rollback()

def import_osc_data(conn, filename):
    try:
        tree = ET.parse(filename)
        root = tree.getroot()
        
        cur = conn.cursor()
        count = 0
        
        # Iterate through 'create' (and potentially 'modify') sections
        # OSC structure usually has create/modify/delete blocks
        for section in root:
            if section.tag in ['create', 'modify']:
                for node in section.findall('node'):
                    osm_id = node.get('id')
                    lat = node.get('lat')
                    lon = node.get('lon')
                    
                    if lat and lon:
                        # Extract tags
                        tags = {}
                        for tag in node.findall('tag'):
                            tags[tag.get('k')] = tag.get('v')
                        
                        # Insert into DB
                        # using UPSERT (ON CONFLICT DO UPDATE) to handle re-runs
                        cur.execute("""
                            INSERT INTO poubelles_officielles (osm_id, geom, tags)
                            VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                            ON CONFLICT (osm_id) 
                            DO UPDATE SET geom = EXCLUDED.geom, tags = EXCLUDED.tags;
                        """, (osm_id, float(lon), float(lat), psycopg2.extras.Json(tags)))
                        count += 1
        
        conn.commit()
        cur.close()
        print(f"Successfully imported {count} nodes from {filename}.")
        
    except Exception as e:
        print(f"Error importing data: {e}")
        conn.rollback()

def main():
    if not os.path.exists(OSC_FILE):
        print(f"File {OSC_FILE} not found. Please place it in the same directory.")
        return

    print(f"Connecting to database {DB_NAME}...")
    conn = get_db_connection()
    
    if conn:
        print("Creating table structure...")
        create_table(conn)
        
        print(f"Importing data from {OSC_FILE}...")
        import_osc_data(conn, OSC_FILE)
        
        conn.close()
        print("Done.")

if __name__ == "__main__":
    main()

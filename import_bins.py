import xml.etree.ElementTree as ET
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()

DB_NAME = os.getenv("DB_NAME", "dipk_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def get_db_connection():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def import_bins(osc_file):
    print(f"Connecting to {DB_NAME}...")
    conn = get_db_connection()
    if not conn:
        return

    cur = conn.cursor()
    
    # Ensure table exists (idempotent check)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS poubelles_officielles (
            id SERIAL PRIMARY KEY,
            osm_id BIGINT UNIQUE,
            geom GEOMETRY(Point, 4326),
            tags JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()

    try:
        tree = ET.parse(osc_file)
        root = tree.getroot()
        print(f"Parsing {osc_file}...")
        
        count = 0
        
        # Helper to find nodes in create/modify
        encoded_nodes = []
        
        all_nodes = []
        # Check create and modify sections
        for section in root:
             if section.tag in ['create', 'modify']:
                 all_nodes.extend(section.findall('node'))
        
        # If flat structure (sometimes osc is flat)
        all_nodes.extend(root.findall('node'))

        print(f"Found {len(all_nodes)} nodes total. Filtering for waste_baskets...")

        for node in all_nodes:
            tags = {}
            for tag in node.findall('tag'):
                tags[tag.get('k')] = tag.get('v')
            
            if tags.get('amenity') == 'waste_basket':
                lat = float(node.get('lat'))
                lon = float(node.get('lon'))
                node_id = int(node.get('id'))
                
                # Insert
                cur.execute("""
                    INSERT INTO poubelles_officielles (osm_id, geom, tags)
                    VALUES (%s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s)
                    ON CONFLICT (osm_id) DO UPDATE SET geom = EXCLUDED.geom, tags = EXCLUDED.tags;
                """, (node_id, lon, lat, psycopg2.extras.Json(tags)))
                count += 1
        
        conn.commit()
        print(f"Successfully imported {count} waste baskets.")
        
    except Exception as e:
        print(f"Error importing bins: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    if os.path.exists("changes.osc"):
        import_bins("changes.osc")
    else:
        print("changes.osc not found!")

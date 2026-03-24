import xml.etree.ElementTree as ET
import psycopg2
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

def import_osc_data(osc_file):
    conn = get_db_connection()
    if not conn:
        return

    cur = conn.cursor()
    tree = ET.parse(osc_file)
    root = tree.getroot()

    print(f"Processing {osc_file}...")

    # We look for <create> block primarily
    for action in root: 
        if action.tag == 'create':
            for node in action.findall('node'):
                lat = float(node.get('lat'))
                lon = float(node.get('lon'))
                node_id = int(node.get('id'))
                
                tags = {tag.get('k'): tag.get('v') for tag in node.findall('tag')}
                name = tags.get('name', 'Unknown')
                
                # Logic: Identify Type based on keywords in Name
                
                if "transit" in name.lower():
                    print(f"Found Transit Center: {name}")
                    cur.execute("""
                        INSERT INTO centres_transit (osm_id, name, geom, status)
                        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), 'OPERATIONAL')
                        ON CONFLICT (osm_id) DO NOTHING;
                    """, (node_id, name, lon, lat))
                
                elif "enfouissement" in name.lower():
                    print(f"Found Landfill: {name}")
                    cur.execute("""
                        INSERT INTO centres_enfouissement (osm_id, name, geom)
                        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326))
                        ON CONFLICT (osm_id) DO NOTHING;
                    """, (node_id, name, lon, lat))

    conn.commit()
    cur.close()
    conn.close()
    print("Import completed.")

if __name__ == "__main__":
    import_osc_data("changes(11).osc")

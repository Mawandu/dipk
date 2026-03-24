
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_NAME = os.getenv("DB_NAME", "dipk_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

try:
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    cur = conn.cursor()
    
    # 1. List all Supervisors
    print("--- SUPERVISEURS ---")
    cur.execute("SELECT id, username, role FROM users WHERE role = 'SUPERVISEUR' OR role = 'SUPERVISOR'")
    users = cur.fetchall()
    for u in users:
        print(u)
    
    if users:
        target_sup_id = users[0][0]
        print(f"\nAssigning Center 5 to Supervisor ID {target_sup_id} ({users[0][1]})...")
        
        # 2. Assign Center 5
        cur.execute("UPDATE centres_transit SET supervisor_id = %s WHERE id = 5", (target_sup_id,))
        conn.commit()
        print("Assignment successful.")

        # 3. Verify
        cur.execute("SELECT * FROM centres_transit WHERE id = 5")
        center = cur.fetchone()
        print(f"Center 5 Updated: {center}")

    else:
        print("No supervisors found to assign.")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")

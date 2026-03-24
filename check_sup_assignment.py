
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
    
    # Get user ID
    cur.execute("SELECT id, username, role FROM users WHERE username = 'superviseur1'")
    user = cur.fetchone()
    if user:
        print(f"User: {user}")
        user_id = user[0]
        
        # Check centers assigned
        cur.execute("SELECT * FROM centres_transit WHERE supervisor_id = %s", (user_id,))
        centers = cur.fetchall()
        print(f"Centers for supervisor {user_id}: {centers}")
        
        # Check center 5 specifically
        cur.execute("SELECT * FROM centres_transit WHERE id = 5")
        center5 = cur.fetchone()
        print(f"Center 5: {center5}")
    else:
        print("User superviseur1 not found")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")

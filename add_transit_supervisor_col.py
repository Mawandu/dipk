
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
    # Add supervisor_id column
    cur.execute("ALTER TABLE centres_transit ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id);")
    conn.commit()
    print("Column supervisor_id added successfully.")
    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")

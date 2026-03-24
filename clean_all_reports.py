import os
import glob
import psycopg2
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DB_NAME = os.getenv("DB_NAME", "dipk_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

def clean_db():
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        cur = conn.cursor()
        print("Cleaning 'signalements' table...")
        cur.execute("TRUNCATE TABLE signalements RESTART IDENTITY;")
        conn.commit()
        cur.close()
        conn.close()
        print("Database table 'signalements' truncated.")
    except Exception as e:
        print(f"Error cleaning DB: {e}")

def clean_uploads():
    upload_dir = "uploads"
    if not os.path.exists(upload_dir):
        print("Uploads directory not found.")
        return

    print(f"Cleaning files in '{upload_dir}'...")
    files = glob.glob(os.path.join(upload_dir, "*"))
    for f in files:
        try:
            os.remove(f)
            print(f"Deleted {f}")
        except Exception as e:
            print(f"Error deleting {f}: {e}")

if __name__ == "__main__":
    clean_db()
    clean_uploads()

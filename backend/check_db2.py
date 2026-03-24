from main import get_db_connection
conn = get_db_connection()
cur = conn.cursor()
try:
    cur.execute("ALTER TABLE centres_enfouissement ADD COLUMN IF NOT EXISTS supervisor_id INTEGER REFERENCES users(id)")
    cur.execute("ALTER TABLE centres_enfouissement ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'OPERATIONAL'")
    cur.execute("ALTER TABLE centres_enfouissement ADD COLUMN IF NOT EXISTS current_load FLOAT DEFAULT 0")
    cur.execute("ALTER TABLE centres_enfouissement ADD COLUMN IF NOT EXISTS capacity_max FLOAT DEFAULT 10000")
    conn.commit()
    print("Columns added successfully.")
except Exception as e:
    print(f"Error: {e}")

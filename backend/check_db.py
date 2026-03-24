from main import get_db_connection
conn = get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'centres_enfouissement'")
for row in cur.fetchall():
    print(row)

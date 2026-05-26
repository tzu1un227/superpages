from db_utils import get_db_connection

conn = get_db_connection()
cur = conn.cursor()
# We don't know the exact app_id, let's find the table
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'history:%'")
tables = cur.fetchall()
for t in tables:
    table_name = t[0]
    print(f"Table: {table_name}")
    cur.execute(f'SELECT category, content, timestamp FROM "{table_name}" ORDER BY timestamp DESC LIMIT 20')
    rows = cur.fetchall()
    for r in rows:
        print(r)

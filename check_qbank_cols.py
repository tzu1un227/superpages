import psycopg2, json
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from backend.app import get_db_connection
conn = get_db_connection()
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Q_bank:%' LIMIT 1")
table = cur.fetchone()[0]
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = %s", (table,))
print([r[0] for r in cur.fetchall()])

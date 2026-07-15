import os, sys
sys.path.append(os.getcwd())
from app import app
from db_utils import get_db_connection

with app.app_context():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Q_bank:%%' LIMIT 1")
    res = cur.fetchone()
    if res:
        table = res[0]
        cur.execute(f'SELECT DISTINCT type FROM "{table}"')
        print("Distinct types:", [r[0] for r in cur.fetchall()])

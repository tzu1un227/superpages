import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5007",
    "user": "postgres",
    "password": "0000"
}

def check_recent():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        one_hour_ago = datetime.now() - timedelta(hours=1)
        cur.execute('SELECT * FROM "history:5007" WHERE timestamp > %s ORDER BY timestamp DESC', (one_hour_ago,))
        rows = cur.fetchall()
        print(f"Found {len(rows)} entries in the last hour")
        for row in rows:
            print(row)
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_recent()

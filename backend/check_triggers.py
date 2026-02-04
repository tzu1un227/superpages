import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_triggers():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Check for iup| and cron| entries which represent project start and step messages
        cur.execute('SELECT * FROM "history:5013" WHERE content LIKE %s OR content LIKE %s ORDER BY timestamp DESC LIMIT 20', ('iup|%', 'QA|cron_%'))
        rows = cur.fetchall()
        print(f"Found {len(rows)} potential project-related entries")
        for row in rows:
            print(row)
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_triggers()

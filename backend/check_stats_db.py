import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_stats():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('SELECT name, value FROM "Global_var:5013" WHERE name LIKE %s', ('pj:1:stats:%',))
        rows = cur.fetchall()
        print(f"Found {len(rows)} stats entries for project 1")
        for row in rows[:5]:
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_stats()


import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def inspect():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('SELECT DISTINCT category FROM "history:5013"')
        rows = cur.fetchall()
        print("Categories:", [r['category'] for r in rows])
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect()

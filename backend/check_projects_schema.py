
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_projects():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("--- Table projects columns ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects'")
        rows = cur.fetchall()
        for row in rows:
            print(f"{row['column_name']} ({row['data_type']})")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_projects()

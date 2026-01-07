import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("--- Table cron_table columns ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cron_table'")
        for row in cur.fetchall():
            print(row)
            
        print("\n--- Checking if scheduled_events table exists ---")
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'scheduled_events')")
        print(f"scheduled_events exists: {cur.fetchone()['exists']}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()

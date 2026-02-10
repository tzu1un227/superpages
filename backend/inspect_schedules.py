import psycopg2
from psycopg2.extras import RealDictCursor
import json

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_schedules():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT count(*) FROM project_schedules")
        count = cur.fetchone()['count']
        print(f"Total schedules in project_schedules: {count}")
        
        if count > 0:
            cur.execute("SELECT * FROM project_schedules LIMIT 5")
            rows = cur.fetchall()
            print("Sample schedules:")
            for row in rows:
                print(row)
                
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error checking schedules: {e}")

if __name__ == "__main__":
    check_schedules()

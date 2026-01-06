import psycopg2
from psycopg2.extras import RealDictCursor
import json
from datetime import datetime

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
        
        start_time = '2025-05-01'
        end_time = datetime.now().isoformat()
        group_unit = 'day'
        
        print(f"Testing statistics from {start_time} to {end_time}...")
        
        for category in ['follow', 'user', 'message']:
            print(f"\nCategory: {category}")
            cur.execute(
                "SELECT * FROM get_events_count_by_category_and_tag(%s, %s, %s, %s)",
                (start_time, end_time, category, group_unit)
            )
            rows = cur.fetchall()
            print(f"Found {len(rows)} rows")
            for row in rows[:5]:
                print(row)
        
        # Also check function definition
        print("\nFunction definition for get_events_count_by_category_and_tag:")
        cur.execute("""
            SELECT prosrc 
            FROM pg_proc 
            JOIN pg_namespace n ON n.oid = pronamespace 
            WHERE proname = 'get_events_count_by_category_and_tag'
        """)
        func_def = cur.fetchone()
        if func_def:
            print(func_def['prosrc'])
        else:
            print("Function not found!")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_stats()

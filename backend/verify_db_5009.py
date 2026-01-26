import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5009"

def check_db():
    try:
        print(f"Connecting to {DB_URL}...")
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Check static_view table
        print("\n[1] Checking 'static_view' table...")
        try:
            cur.execute("SELECT count(*) as cnt, min(timestamp) as min_ts, max(timestamp) as max_ts FROM static_view")
            row = cur.fetchone()
            print(f"   - Row count: {row['cnt']}")
            print(f"   - Time range: {row['min_ts']} to {row['max_ts']}")
        except Exception as e:
            print(f"   - Error: {e}")
            conn.rollback()

        # 2. Check functions
        print("\n[2] Checking stored functions...")
        funcs = ['get_events_count_by_category_and_tag', 'get_keyword_ranking']
        for f in funcs:
            cur.execute("SELECT proname FROM pg_proc WHERE proname = %s", (f,))
            if cur.fetchone():
                print(f"   - Function '{f}' EXISTS.")
            else:
                print(f"   - Function '{f}' MISSING.")

        # 3. Test Keyword Ranking
        print("\n[3] Testing get_keyword_ranking...")
        try:
             # Use a wide range
             cur.execute("SELECT * FROM get_keyword_ranking('2020-01-01', '2030-01-01', NULL, 5)")
             results = cur.fetchall()
             print(f"   - Results: {results}")
        except Exception as e:
            print(f"   - Error executing function: {e}")
            conn.rollback()

    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    check_db()

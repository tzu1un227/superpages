import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5009"
APP_ID = "5009"

def test_optimized():
    try:
        print(f"Connecting to {DB_URL}...")
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        print("\nRunning Optimized Query...")
        query = f"""
            SELECT * FROM (
                SELECT DISTINCT ON (user_id) user_id, 
                       content as last_message, 
                       timestamp as last_time
                FROM "history:{APP_ID}"
                ORDER BY user_id, timestamp DESC
            ) sub
            ORDER BY last_time DESC NULLS LAST
            LIMIT 50
        """
        
        try:
            cur.execute(query)
            rows = cur.fetchall()
            print(f"Query returned {len(rows)} rows.")
            if rows:
                print("Sample row:", rows[0])
            
            # Also fetch tags separately or via JOIN if needed, but original query had 3rd subquery for tags.
            # (SELECT string_agg(value, '|') FROM "Private_var:..." ...)
            # We can add that to the outer select?
            # Or inside? Inside is better per user.
            
        except Exception as e:
            print(f"Query Error: {e}")
            conn.rollback()

        conn.close()

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_optimized()

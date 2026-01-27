import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5009"
APP_ID = "5009"

def test_query():
    try:
        print(f"Connecting to {DB_URL}...")
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Check history:5009 count
        print(f"Checking history:{APP_ID} count...")
        try:
            cur.execute(f'SELECT count(*) as cnt FROM "history:{APP_ID}"')
            print(f"Count: {cur.fetchone()['cnt']}")
        except Exception as e:
            print(f"Error checking history: {e}")
            conn.rollback()

        # 2. Run the full API query
        print("\nRunning API Query...")
        query = f"""
            SELECT DISTINCT h.user_id, 
                   (SELECT content FROM "history:{APP_ID}" WHERE user_id = h.user_id ORDER BY timestamp DESC LIMIT 1) as last_message,
                   (SELECT timestamp FROM "history:{APP_ID}" WHERE user_id = h.user_id ORDER BY timestamp DESC LIMIT 1) as last_time
            FROM "history:{APP_ID}" h
            ORDER BY last_time DESC NULLS LAST
            LIMIT 5
        """
        # Removed Private_var tag subquery for simplicity first, or include it if confident
        
        try:
            cur.execute(query)
            rows = cur.fetchall()
            print(f"Query returned {len(rows)} rows.")
            for r in rows:
                print(r)
        except Exception as e:
            print(f"Query Error: {e}")
            conn.rollback()

        conn.close()

    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_query()

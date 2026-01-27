import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5009"

def check_db():
    try:
        print(f"Connecting to {DB_URL}...")
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. List all tables
        print("\n[1] Listing all tables in public schema...")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        for t in tables:
            print(f"   - {t['table_name']}")

        # 2. Check for history tables specific to 5009
        print("\n[2] Checking specific history tables...")
        possible_names = ['history', 'history:5009', 'history:5013']
        for name in possible_names:
            if any(t['table_name'] == name for t in tables):
                 print(f"   - Table '{name}' FOUND.")
                 # Get count
                 try:
                     cur.execute(f'SELECT count(*) as cnt FROM "{name}"')
                     cnt = cur.fetchone()['cnt']
                     print(f"     -> Row count: {cnt}")
                 except Exception as e:
                     print(f"     -> Error reading: {e}")
            else:
                 print(f"   - Table '{name}' NOT found.")

    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    check_db()

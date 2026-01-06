
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("Checking tables...")
        
        # List all tables
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchall()
        print(f"Tables in 'public' schema: {[t['table_name'] for t in tables]}")
        
        # Check if history exists
        if any(t['table_name'] == 'history' for t in tables):
            cur.execute("SELECT COUNT(*) FROM history")
            history_count = cur.fetchone()['count']
            print(f"History count: {history_count}")
        else:
            print("Table 'history' NOT FOUND in public schema.")
        
        # Check projects table
        cur.execute("SELECT COUNT(*) FROM projects")
        projects_count = cur.fetchone()['count']
        print(f"Projects count: {projects_count}")
        
        # Check if function exists
        cur.execute("""
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_type = 'FUNCTION' 
            AND routine_name = 'get_events_count_by_category_and_tag'
        """)
        func = cur.fetchone()
        print(f"Function 'get_events_count_by_category_and_tag' exists: {func is not None}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

if __name__ == "__main__":
    check_db()

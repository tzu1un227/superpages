
import psycopg2

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def get_func_def():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_events_count_by_category_and_tag'")
        res = cur.fetchone()
        if res:
            # Use utf-8 for output
            import sys
            sys.stdout.reconfigure(encoding='utf-8')
            print(res[0])
        else:
            print("Function not found")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_func_def()

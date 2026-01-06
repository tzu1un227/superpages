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

def check_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("Checking static_view definition:")
        cur.execute("SELECT view_definition FROM information_schema.views WHERE table_name = 'static_view'")
        view_def = cur.fetchone()
        if view_def:
            print(view_def['view_definition'])
        else:
            print("static_view not found in information_schema.views. Checking if it is a materialized view or table...")
            cur.execute("SELECT definition FROM pg_matviews WHERE matviewname = 'static_view'")
            matview_def = cur.fetchone()
            if matview_def:
                print("Materialized view detected:")
                print(matview_def['definition'])
            else:
                print("static_view is likely a normal table or doesn't exist.")

        print("\nChecking sample data from static_view where tag starts with '[':")
        cur.execute("SELECT * FROM static_view WHERE tag LIKE '[%' LIMIT 5")
        rows = cur.fetchall()
        for row in rows:
            print(row)

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()

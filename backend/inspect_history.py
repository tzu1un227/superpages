
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def inspect():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get one row from history table
        # We assume the table name is "history:5013" based on app_id default
        cur.execute('SELECT * FROM "history:5013" LIMIT 1')
        row = cur.fetchone()
        
        if row:
            print("Columns found:", row.keys())
            print("Sample row:", row)
        else:
            print("Table found but empty.")
            # Get column names from cursor description
            print("Columns from description:", [desc[0] for desc in cur.description])
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect()


import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Check if columns exist using information_schema
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' AND column_name IN ('anchor_config', 'dormancy_config')
        """)
        existing_cols = [row[0] for row in cur.fetchall()]
        
        if 'anchor_config' not in existing_cols:
            print("Adding anchor_config column...")
            cur.execute("ALTER TABLE projects ADD COLUMN anchor_config JSONB DEFAULT '{}'")
        else:
            print("anchor_config already exists.")
            
        if 'dormancy_config' not in existing_cols:
            print("Adding dormancy_config column...")
            cur.execute("ALTER TABLE projects ADD COLUMN dormancy_config JSONB DEFAULT '{}'")
        else:
            print("dormancy_config already exists.")
            
        conn.commit()
        cur.close()
        conn.close()
        print("Migration completed.")
    except Exception as e:
        print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()

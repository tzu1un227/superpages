import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def migrate_schema():
    conn = None
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("Starting migration...")

        # 1. Convert id to integer
        print("Converting id column to integer...")
        cur.execute('ALTER TABLE ticket_table ALTER COLUMN id TYPE INTEGER USING id::integer')
        
        # 2. Create sequence
        print("Creating sequence ticket_id_seq...")
        cur.execute('CREATE SEQUENCE IF NOT EXISTS ticket_id_seq')
        
        # 3. Get max id
        cur.execute('SELECT MAX(id) FROM ticket_table')
        max_id = cur.fetchone()[0]
        if max_id is None:
            max_id = 0
        print(f"Max ID found: {max_id}")
        
        # 4. Set sequence value
        print(f"Setting sequence to {max_id + 1}...")
        cur.execute(f"SELECT setval('ticket_id_seq', {max_id})")
        
        # 5. Set default value for id column
        print("Setting default value for id column...")
        cur.execute("ALTER TABLE ticket_table ALTER COLUMN id SET DEFAULT nextval('ticket_id_seq')")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during migration: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate_schema()

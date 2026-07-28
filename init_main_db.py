import psycopg2
import sys

NEW_RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"

def init_db():
    print(f"Connecting to {NEW_RDS_URL}...")
    try:
        conn = psycopg2.connect(NEW_RDS_URL)
        cur = conn.cursor()
        
        # 1. users 表格
        print("Creating table: users...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                email VARCHAR(120) UNIQUE NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'user',
                allowed_oa_configs JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. pages 表格
        print("Creating table: pages...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                description VARCHAR(200)
            );
        """)

        # 3. permission_settings (OAConfig) 表格
        print("Creating table: permission_settings...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS permission_settings (
                id SERIAL PRIMARY KEY,
                page_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
                oa_name VARCHAR(100) NOT NULL,
                db_url VARCHAR(500),
                other_settings JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        conn.commit()
        print("All main tables initialized successfully!")

        # 驗證表格清單
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = cur.fetchall()
        print("Current tables in superpages DB:", [t[0] for t in tables])

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing DB: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    init_db()

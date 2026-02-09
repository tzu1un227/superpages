from app import app, get_db_connection
import psycopg2

def add_columns():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Add is_recurring to projects
        print("Adding is_recurring to projects table...")
        try:
            cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE")
            conn.commit()
            print("Done.")
        except Exception as e:
            conn.rollback()
            print(f"Skipped projects update: {e}")
            
        # 2. Add status to cron_table (user participation status)
        print("Adding status to cron_table...")
        try:
            # Status: 'active', 'completed', 'paused'
            cur.execute("ALTER TABLE cron_table ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'")
            conn.commit()
            print("Done.")
        except Exception as e:
            conn.rollback()
            print(f"Skipped cron_table update: {e}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    with app.app_context():
        add_columns()

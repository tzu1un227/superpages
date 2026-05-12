
import psycopg2

DB_URL_5013 = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def force_recreate_5013_projects():
    try:
        conn = psycopg2.connect(DB_URL_5013)
        cur = conn.cursor()
        
        # 1. Recreate projects:5013
        print("Forcing recreation of projects:5013...")
        cur.execute("DROP TABLE IF EXISTS \"projects:5013\" CASCADE")
        cur.execute("""
            CREATE TABLE \"projects:5013\" (
                project_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                is_recurring BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)
        
        # 2. Recreate project_schedules:5013
        print("Forcing recreation of project_schedules:5013...")
        cur.execute("DROP TABLE IF EXISTS \"project_schedules:5013\" CASCADE")
        cur.execute("""
            CREATE TABLE \"project_schedules:5013\" (
                schedule_id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES \"projects:5013\"(project_id) ON DELETE CASCADE,
                step_id INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                action_data JSONB,
                delay_minutes INTEGER DEFAULT 0
            )
        """)

        conn.commit()
        print("5013 tables recreated and linked successfully.")
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Error during recreation: {e}")

if __name__ == "__main__":
    force_recreate_5013_projects()

import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_schema():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    for table in ['projects', 'project_schedules', 'cron_table', 'user_project_status']:
        print(f"--- {table} columns ---")
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
        for row in cur.fetchall():
            print(f"{row['column_name']} ({row['data_type']})")
        print()
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_schema()

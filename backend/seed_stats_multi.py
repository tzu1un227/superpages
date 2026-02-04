import psycopg2
from datetime import datetime, timedelta

def seed_to_custom_db(app_id, project_id):
    DB_CONFIG = {
        "host": "140.138.176.197",
        "port": "5432",
        "database": app_id, 
        "user": "postgres",
        "password": "0000"
    }
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Create Global_var table if not exists (though it should exist)
        cur.execute(f'CREATE TABLE IF NOT EXISTS "Global_var:{app_id}" (name text PRIMARY KEY, value text)')
        
        today = datetime.now()
        prefix = f"pj:{project_id}:stats:"
        
        # Clean existing
        cur.execute(f'DELETE FROM "Global_var:{app_id}" WHERE name LIKE %s', (f"{prefix}%",))
        
        for i in range(10):
            date_str = (today - timedelta(days=i)).strftime('%Y-%m-%d')
            data = {
                'tc': 120 + i,
                'cc': 90 + i,
                'ms': 600 + i,
                'mss': 580 + i,
                'msf': 20
            }
            
            for metric, val in data.items():
                name = f"pj:{project_id}:stats:{date_str}:{metric}"
                cur.execute(f'INSERT INTO "Global_var:{app_id}" (name, value) VALUES (%s, %s)', (name, str(val)))
        
        conn.commit()
        print(f"Successfully seeded stats for Project {project_id} in {app_id}")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error seeding {app_id}: {e}")

if __name__ == "__main__":
    seed_to_custom_db('5013', 1)
    seed_to_custom_db('5007', 1)

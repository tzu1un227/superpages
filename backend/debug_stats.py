import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_project_stats():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Find project ID
    cur.execute("SELECT project_id, project_name FROM projects")
    projects = cur.fetchall()
    target_id = None
    for p in projects:
        # Check if project_name contains the search terms (handling encoding)
        name = p['project_name']
        print(f"Found project ID: {p['project_id']}, Name: {name}")
        if "測試" in name or "旅程" in name:
            target_id = p['project_id']
            print(f"Matched target ID: {target_id}")

    if target_id:
        print(f"\n--- Stats for Project {target_id} ---")
        cur.execute(f"SELECT name, value FROM \"Global_var:5013\" WHERE name LIKE 'pj:{target_id}:stats:%'")
        stats = cur.fetchall()
        for s in stats:
            print(f"{s['name']}: {s['value']}")
            
        print("\n--- Schedules ---")
        cur.execute("SELECT step_id, message_content FROM project_schedules WHERE project_id = %s ORDER BY step_id", (target_id,))
        for s in cur.fetchall():
            print(f"Step {s['step_id']}: {s['message_content']}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_project_stats()

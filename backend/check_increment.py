import sys
import os
from datetime import datetime

# Add the backend directory to path
sys.path.append(r'C:\Users\70640\Documents\GitHub\superpages\backend')

from app import app, increment_project_stat, get_db_connection, get_current_app_id
from flask import g
import psycopg2
from psycopg2.extras import RealDictCursor

def check_current_stats(project_id):
    app_id = '5013'
    conn = psycopg2.connect(host='140.138.176.197', port='5432', database='5013', user='postgres', password='0000')
    cur = conn.cursor(cursor_factory=RealDictCursor)
    date_str = datetime.now().strftime('%Y-%m-%d')
    
    metrics = ['tc', 'ttc']
    results = {}
    for m in metrics:
        name = f"pj:{project_id}:stats:{date_str}:{m}"
        cur.execute(f"SELECT value FROM \"Global_var:{app_id}\" WHERE name = %s", (name,))
        row = cur.fetchone()
        results[m] = int(row['value']) if row else 0
    
    cur.close()
    conn.close()
    return results

def simulate_frontend_trigger():
    project_id = 999 # Use a dummy ID to avoid messing with real data
    
    print(f"--- Initial Stats for Project {project_id} ---")
    print(check_current_stats(project_id))
    
    with app.app_context():
        g.current_oa_id = 1
        g.current_db_url = "postgresql://postgres:0000@140.138.176.197:5432/5013"
        
        print(f"\n--- Simulating Trigger for Project {project_id} ---")
        # Simulate what trigger_socket_event does
        increment_project_stat(project_id, 'tc', g.current_oa_id)
        increment_project_stat(project_id, 'ttc', g.current_oa_id)
        
    print(f"\n--- Stats AFTER Simulation ---")
    print(check_current_stats(project_id))

if __name__ == "__main__":
    simulate_frontend_trigger()

import sys
import os
from datetime import datetime

# Add the backend directory to path
sys.path.append(r'C:\Users\70640\Documents\GitHub\superpages\backend')

from app import app, increment_project_stat, db, OAConfig
from flask import g

def simulate_restart_stat():
    with app.app_context():
        # Mock g.current_oa_id and g.current_db_url to simulate a request
        # We'll use OA ID 1 (which matches 5013 in the DB)
        g.current_oa_id = 1
        g.current_db_url = "postgresql://postgres:0000@140.138.176.197:5432/5013"
        
        project_id = 20 # Using a known project ID from earlier
        metric = 'ttc'
        
        print(f"--- Simulating stat increment for Project {project_id} ---")
        increment_project_stat(project_id, metric, g.current_oa_id)
        print("--- Simulation complete ---")

if __name__ == "__main__":
    simulate_restart_stat()

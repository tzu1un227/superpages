import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from db_utils import get_db_connection
from models import OAConfig

def check_all_tenants():
    with app.app_context():
        oas = OAConfig.query.all()
        for oa in oas:
            settings = oa.other_settings or {}
            app_name = settings.get('app_name') or 'unknown'
            db_url = settings.get('db_url') or oa.db_url
            print(f"\n--- Checking OA {oa.id}: {oa.oa_name} (app_name: {app_name}) ---")
            g.current_oa_id = oa.id
            g.current_db_url = db_url
            g.current_app_name = app_name
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute(f'SELECT id, type, content, function, note FROM "Q_bank:{app_name}" WHERE content::text LIKE \'%switch_rm%\'')
                rows = cur.fetchall()
                for r in rows:
                    print(dict(r))
                cur.close()
                conn.close()
            except Exception as e:
                print(f"Error checking {app_name}: {e}")

if __name__ == '__main__':
    check_all_tenants()

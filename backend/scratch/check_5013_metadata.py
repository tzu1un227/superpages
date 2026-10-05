import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from db_utils import get_db_connection
from models import OAConfig

def check_metadata():
    with app.app_context():
        oa = OAConfig.query.get(5)
        g.current_oa_id = 5
        g.current_db_url = oa.other_settings.get('db_url') or oa.db_url
        g.current_app_name = '5013'
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('SELECT * FROM "rich_menu_metadata:5013"')
        for r in cur.fetchall():
            print(dict(r))

        cur.close()
        conn.close()

if __name__ == '__main__':
    check_metadata()

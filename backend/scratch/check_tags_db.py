import sys, os
sys.path.insert(0, r'c:\Users\70640\Documents\GitHub\superpages\backend')
from app import app
from models import OAConfig
from db_utils import get_db_connection
from psycopg2.extras import RealDictCursor

with app.app_context():
    oas = OAConfig.query.all()
    for oa in oas:
        app_name = oa.other_settings.get('app_name') if oa.other_settings else str(oa.id)
        if not app_name: app_name = str(oa.id)
        print(f"=== OA: {oa.id} - {oa.oa_name} - app_name: {app_name} ===")
        try:
            conn = get_db_connection(oa.db_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(f'SELECT user_id, name, value FROM "Private_var:{app_name}" WHERE name IN (\'tag\', \'g_group\') LIMIT 20')
            rows = cur.fetchall()
            for r in rows:
                print(r)
            conn.close()
        except Exception as e:
            print("Error:", e)

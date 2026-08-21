import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from db_utils import get_db_connection
from models import OAConfig

ROBUST_SWITCH_RM_FUNCTION = """(lambda res: (pri_set('rm_info', res[0]), update("set_menu") if not res[0].get('permission_tags') or (set(res[0].get('permission_tags', [])) & set(eval(pri('tag') or '[]'))) else update("fallback")) if res else "")(dboperation.dbModel.getTable(f"rich_menu_metadata:{dboperation.dbModel.appname}", filter=[('rich_menu_id' if c_cut(1).startswith('richmenu-') else 'ui_uuid', c_cut(1))]) or dboperation.dbModel.getTable(f"rich_menu_metadata:{dboperation.dbModel.appname}", filter=[('rich_menu_id', c_cut(1))]))"""

def update_switch_rm_rules():
    with app.app_context():
        oas = OAConfig.query.all()
        for oa in oas:
            settings = oa.other_settings or {}
            app_name = settings.get('app_name') or 'unknown'
            db_url = settings.get('db_url') or oa.db_url
            if app_name not in ['5013', 'yzulabuse']:
                continue
                
            print(f"\n--- Updating Q_bank:{app_name} ---")
            g.current_oa_id = oa.id
            g.current_db_url = db_url
            g.current_app_name = app_name
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                
                # Update Postback & Sensor rules for switch_rm|*
                cur.execute(f'''
                    UPDATE "Q_bank:{app_name}"
                    SET function = %s
                    WHERE 'switch_rm|*' = ANY(content)
                ''', (ROBUST_SWITCH_RM_FUNCTION,))
                conn.commit()
                print(f"Updated {cur.rowcount} rules in Q_bank:{app_name}")
                
                # Verify
                cur.execute(f'''SELECT id, type, content, function, note FROM "Q_bank:{app_name}" WHERE 'switch_rm|*' = ANY(content)''')
                for r in cur.fetchall():
                    print(f"ID {r['id']} ({r['type']}): {r['function'][:120]}...")
                    
                cur.close()
                conn.close()
            except Exception as e:
                import traceback
                print(f"Error updating {app_name}: {e}")
                traceback.print_exc()

if __name__ == '__main__':
    update_switch_rm_rules()

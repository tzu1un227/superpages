import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from db_utils import get_db_connection
from models import OAConfig

def check_5013():
    with app.app_context():
        oas = OAConfig.query.all()
        target_oa = None
        for oa in oas:
            settings = oa.other_settings or {}
            print(f"OA {oa.id}: oa_name={oa.oa_name}, app_name={settings.get('app_name')}")
            if settings.get('app_name') == '5013' or '5013' in str(oa.oa_name):
                target_oa = oa
                
        if not target_oa and oas:
            target_oa = oas[0]
            
        print(f"\nTarget OA: ID={target_oa.id}, oa_name={target_oa.oa_name}, other_settings={target_oa.other_settings}")
        g.current_oa_id = target_oa.id
        if target_oa.other_settings:
            g.current_db_url = target_oa.other_settings.get('db_url') or target_oa.db_url
            g.current_app_name = target_oa.other_settings.get('app_name', '5013')
        else:
            g.current_db_url = target_oa.db_url
            g.current_app_name = '5013'
            
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = g.current_app_name
        
        print(f"\n=== 1. Checking rich_menu_metadata:{app_id} ===")
        try:
            cur.execute(f'SELECT id, name, rich_menu_id, ui_uuid, status, permission_tags FROM "rich_menu_metadata:{app_id}"')
            rows = cur.fetchall()
            for r in rows:
                print(dict(r))
        except Exception as e:
            print(f"Error querying rich_menu_metadata:{app_id}: {e}")
            conn.rollback()
            
        print(f"\n=== 2. Checking Q_bank:{app_id} for switch_rm rules ===")
        try:
            cur.execute(f'SELECT id, type, content, state_in, function, note FROM "Q_bank:{app_id}" WHERE content::text LIKE \'%switch_rm%\' OR function::text LIKE \'%switch_rm%\' OR function::text LIKE \'%rm_info%\'')
            rows = cur.fetchall()
            for r in rows:
                print(dict(r))
        except Exception as e:
            print(f"Error querying Q_bank:{app_id}: {e}")
            conn.rollback()

        print(f"\n=== 3. Checking project_schedules for switch_rm or richmenu-1c76808513aee69287d4810cfe304992 ===")
        try:
            cur.execute(f'''
                SELECT ps.id, ps.project_id, p.name as project_name, ps.step_id, ps.message_content
                FROM "project_schedules:{app_id}" ps
                JOIN "projects:{app_id}" p ON ps.project_id = p.id
                WHERE ps.message_content::text LIKE '%richmenu-1c76808513aee69287d4810cfe304992%' 
                   OR ps.message_content::text LIKE '%switch_rm%'
            ''')
            rows = cur.fetchall()
            for r in rows:
                print(f"Project: {r['project_name']}, Step: {r['step_id']}")
                print(f"Message Content: {json.dumps(r['message_content'], ensure_ascii=False)}")
        except Exception as e:
            print(f"Error querying project_schedules:{app_id}: {e}")
            conn.rollback()

        cur.close()
        conn.close()

if __name__ == '__main__':
    check_5013()

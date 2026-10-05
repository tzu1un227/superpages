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

def check_sys_bind():
    with app.app_context():
        oa = OAConfig.query.all()
        target_oa = next((o for o in oa if str(o.id) == '5' or o.other_settings.get('app_name') == '5013'), None)
        g.current_oa_id = target_oa.id
        g.current_db_url = target_oa.other_settings.get('db_url') or target_oa.db_url
        g.current_app_name = '5013'
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("=== 1. Q_bank:5013 sys_bind rules ===")
        cur.execute('SELECT id, type, content, function, note FROM "Q_bank:5013" WHERE content::text LIKE \'%sys_bind%\'')
        for r in cur.fetchall():
            print(dict(r))

        print("\n=== 2. QA_bank:5013 最新 5 筆資料 ===")
        cur.execute('SELECT id, type, tag, msg_rpy FROM "QA_bank:5013" ORDER BY id DESC LIMIT 5')
        for r in cur.fetchall():
            print(f"ID: {r['id']}, tag: {r['tag']}")
            print(f"msg_rpy: {json.dumps(r['msg_rpy'], ensure_ascii=False)}")

        print("\n=== 3. Private_var:5013 邱子倫 (U6d82c4b234135c5f0a2af724e81cf089) 的所有記錄 ===")
        cur.execute('SELECT user_id, name, value FROM "Private_var:5013" WHERE user_id = %s', ('U6d82c4b234135c5f0a2af724e81cf089',))
        for r in cur.fetchall():
            print(f"Name: {r['name']}, Value: {r['value']}")

        cur.close()
        conn.close()

if __name__ == '__main__':
    check_sys_bind()

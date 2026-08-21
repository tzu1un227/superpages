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

def check_qa_bank():
    with app.app_context():
        oas = OAConfig.query.all()
        target_oa = next((o for o in oas if str(o.id) == '5' or o.other_settings.get('app_name') == '5013'), None)
        g.current_oa_id = target_oa.id
        g.current_db_url = target_oa.other_settings.get('db_url') or target_oa.db_url
        g.current_app_name = '5013'
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute('SELECT column_name FROM information_schema.columns WHERE table_name = %s', ('QA_bank:5013',))
        cols = [r['column_name'] for r in cur.fetchall()]
        print("QA_bank:5013 columns:", cols)

        cur.execute('SELECT * FROM "QA_bank:5013"')
        rows = cur.fetchall()
        for r in rows:
            print(f"\nQA ID: {r.get('id')}")
            for col in cols:
                val = r.get(col)
                if val is not None:
                    print(f"  {col}: {json.dumps(val, ensure_ascii=False) if isinstance(val, (dict, list)) else str(val)[:200]}")

        cur.close()
        conn.close()

if __name__ == '__main__':
    check_qa_bank()

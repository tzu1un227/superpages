import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import os
import json
import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from db_utils import get_db_connection
from models import OAConfig

def json_serial(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

def verify_5013():
    with app.app_context():
        oas = OAConfig.query.all()
        oa = next((o for o in oas if str(o.id) == '5' or o.other_settings.get('app_name') == '5013'), None)
        g.current_oa_id = oa.id
        g.current_db_url = oa.other_settings.get('db_url') or oa.db_url
        g.current_app_name = '5013'
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. 取得 switch_rm 法則
        cur.execute('SELECT function FROM "Q_bank:5013" WHERE id = 11')
        rule_func = cur.fetchone()['function']
        print(f"Rule 11 Function in DB:\n{rule_func}\n")
        
        # 2. 模擬點擊 Flex 圖片傳入的參數: richmenu-1c76808513aee69287d4810cfe304992
        target_payload = "richmenu-1c76808513aee69287d4810cfe304992"
        
        # 建立模擬環境 (模擬 Line-Bot-Main 的執行環境)
        class DBModelMock:
            appname = '5013'
            @staticmethod
            def getTable(table_name, filter=None):
                t_cur = conn.cursor(cursor_factory=RealDictCursor)
                query = f'SELECT * FROM "{table_name}"'
                params = []
                if filter:
                    k, v = filter[0]
                    query += f' WHERE {k} = %s'
                    params.append(v)
                t_cur.execute(query, tuple(params))
                rows = t_cur.fetchall()
                t_cur.close()
                return [json.loads(json.dumps(dict(r), default=json_serial)) for r in rows]

        class DBOperationMock:
            dbModel = DBModelMock

        storage = {'tag': "['一般顧客']"}
        actions = []
        
        env = {
            'c_cut': lambda idx: target_payload,
            'pri_set': lambda k, v: storage.update({k: json.dumps(v, default=json_serial, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)}),
            'pri': lambda k: storage.get(k, ''),
            'update': lambda a: actions.append(a),
            'dboperation': DBOperationMock,
            'set': set,
            'eval': eval
        }
        
        print("=== 執行模擬 switch_rm 事件 ===")
        exec(rule_func, env)
        print("Storage rm_info:", storage.get('rm_info'))
        print("Triggered Actions:", actions)
        
        assert actions == ['set_menu'], f"Expected ['set_menu'], but got {actions}"
        rm_info = json.loads(storage.get('rm_info'))
        assert rm_info['rich_menu_id'] == 'richmenu-1c76808513aee69287d4810cfe304992'
        print("\n[SUCCESS] 5013 點擊測試旅程 flex 圖片按鈕切換選單驗證 100% 成功！")

        cur.close()
        conn.close()

if __name__ == '__main__':
    verify_5013()

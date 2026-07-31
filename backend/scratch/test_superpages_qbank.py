import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Force UTF-8 output encoding for Windows stdout
sys.stdout.reconfigure(encoding='utf-8')

# Primary DB URL to fetch OA Config
MAIN_DB_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

def test_superpages_db():
    print("=== [Superpages 權限帳號 DB 測試] ===")
    
    # 1. 連線至主資料庫取得 superpages 帳號 (id=4) 的 db_url 與 app_name
    conn_main = psycopg2.connect(MAIN_DB_URL)
    cur_main = conn_main.cursor(cursor_factory=RealDictCursor)
    cur_main.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings WHERE oa_name = 'superpages' OR id = 4 LIMIT 1")
    superpages_oa = cur_main.fetchone()
    cur_main.close()
    conn_main.close()

    if not superpages_oa:
        print("[ERROR] 找不到 superpages 帳號權限設定！")
        return

    db_url = superpages_oa['db_url']
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
        
    app_name = superpages_oa.get('other_settings', {}).get('app_name', 'yzulabuse')
    print(f"[OK] 找到 superpages 帳號設定 (OA ID: {superpages_oa['id']}) | Target app_name: '{app_name}'")
    print(f"[OK] Target DB Host: {db_url.split('@')[-1].split('/')[0]}")

    # 2. 連線至 superpages 帳號的真實資料庫
    conn_target = psycopg2.connect(db_url)
    cur_target = conn_target.cursor(cursor_factory=RealDictCursor)

    target_table = f"Q_bank:{app_name}"
    
    # 3. 檢查資料庫是否有目標資料表 (切記不要新增資料表)
    cur_target.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (target_table,))
    if not cur_target.fetchone():
        print(f"[ERROR] 沒有找到目標資料表 \"{target_table}\"！切記不要新增資料表！")
        cur_target.close()
        conn_target.close()
        return

    print(f"[OK] 成功找到目標資料表: \"{target_table}\" (沒有新增任何資料表)")

    # 4.1 查詢資料表欄位型態
    cur_target.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s", (target_table,))
    cols_info = {r['column_name']: r['data_type'] for r in cur_target.fetchall()}
    print(f"[INFO] \"{target_table}\" 欄位型態: {cols_info}")

    # 4.2 查詢現有的 Follow 法則
    cur_target.execute(f'SELECT * FROM "{target_table}" WHERE type = %s', ('Follow',))
    existing_follow_rules = cur_target.fetchall()
    print(f"[INFO] 現有 \"{target_table}\" 中的 Follow 法則共 {len(existing_follow_rules)} 筆:")
    for r in existing_follow_rules:
        print(f"    - ID: {r['id']} | Content: {r.get('content')} ({type(r.get('content'))}) | Note: '{r.get('note')}' | Function: '{r.get('function')}'")

    # 5. 模擬設定/寫入一筆加入好友訊息法則
    test_note = "加入好友訊息 - 測試驗證"
    test_func = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m)),update(f"set_tag|[\'測試標籤\']")'
    test_msg = [json.dumps("歡迎加入 superpages 測試帳號！", ensure_ascii=False)]

    active_count = sum(1 for r in existing_follow_rules if (r['content'] == ['*'] or r['content'] == '*' or str(r['content']) == "['*']"))
    
    # 依欄位型態調整 content 傳值
    if cols_info.get('content') in ('ARRAY', 'jsonb') or 'ARRAY' in cols_info.get('content', '').upper():
        new_content = ['OFF']
    else:
        new_content = 'OFF'

    # 取得當前 MAX(id)
    cur_target.execute(f'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM "{target_table}"')
    next_id = cur_target.fetchone()['next_id']

    insert_sql = f'''
        INSERT INTO "{target_table}" ("id", "state_in", "type", "content", "msg_rpy", "function", "state_out", "note")
        VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s) RETURNING id
    '''
    cur_target.execute(insert_sql, (next_id, ['*'], 'Follow', new_content, test_msg, test_func, '*', test_note))
    new_id = cur_target.fetchone()['id']
    conn_target.commit()
    print(f"[OK] [寫入測試] 成功新增一筆加入好友法則至 \"{target_table}\"，ID: {new_id}")

    # 6. 重新查詢資料庫驗證
    cur_target.execute(f'SELECT * FROM "{target_table}" WHERE id = %s', (new_id,))
    rule_check = cur_target.fetchone()
    print("[INFO] [DB 驗證] 寫入結果對照:")
    print(f"    - ID: {rule_check['id']}")
    print(f"    - Type: '{rule_check['type']}'")
    print(f"    - Content: '{rule_check['content']}' (單一啟用設定值)")
    print(f"    - Note 欄位註記: '{rule_check['note']}' (包含 '加入好友訊息': {'加入好友訊息' in rule_check['note']})")
    func_check = ('pri_set("name",sys.name(m))' in rule_check['function']) and ('pri_set("pic",sys.picture(m))' in rule_check['function'])
    print(f"    - Function 固定語法驗證結果: {func_check}")

    # 7. 清理測試資料，保持 DB 乾淨
    cur_target.execute(f'DELETE FROM "{target_table}" WHERE id = %s', (new_id,))
    conn_target.commit()
    print(f"[OK] [還原清理] 測試法則 (ID: {new_id}) 已安全刪除，資料庫已還原至原始狀態。")

    cur_target.close()
    conn_target.close()
    print("=== [superpages 帳號 DB 測試成功完成] ===")

if __name__ == '__main__':
    test_superpages_db()


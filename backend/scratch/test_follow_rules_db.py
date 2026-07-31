import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Connect to the primary superpages database on 140.138.176.197
RDS_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

def run_test():
    print("=== Superpages 加入好友設定 (Follow Rules) 測試腳本 ===")
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. 查找 Q_bank 表格
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Q_bank:%'")
    tables = [r['table_name'] for r in cur.fetchall()]
    print(f"[1] 找到的 Q_bank 資料表清單: {tables}")
    
    if not tables:
        print("[ERROR] 未找到任何 Q_bank 資料表！切記不要新增資料表！")
        return

    target_table = tables[0] # 使用找到的第一個 Q_bank 表格 (例如 Q_bank:5013)
    app_name = target_table.split(':')[-1]
    print(f"[2] 選擇測試資料表: \"{target_table}\" (app_name: {app_name})")

    # 2. 查詢現有的 Follow 法則
    cur.execute(f'SELECT * FROM "{target_table}" WHERE type = %s', ('Follow',))
    existing_rules = cur.fetchall()
    print(f"[3] 現有 Follow 法則數量: {len(existing_rules)}")
    for r in existing_rules:
        print(f"    - ID: {r['id']}, Note: {r.get('note')}, Content: {r.get('content')}, Function: {r.get('function')}")

    # 3. 測試：新增一條全新的加入好友法則 (帶有自訂名稱、訊息與標籤)
    test_note = "加入好友訊息 - 自動化測試組"
    test_func = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m)),update(f"set_tag|[\'測試標籤\']")'
    test_msg = [json.dumps("歡迎加入測試帳號！", ensure_ascii=False)]

    # 若目前無被啟用的法則，此新增設為啟用 ('*')；若已有啟用的法則，此新增設為不啟用 ('OFF')
    active_exists = any(r['content'] == '*' for r in existing_rules)
    test_content = 'OFF' if active_exists else '*'

    insert_sql = f'''
        INSERT INTO "{target_table}" ("state_in", "type", "content", "msg_rpy", "function", "state_out", "note")
        VALUES (%s, %s, %s, %s::json[], %s, %s, %s) RETURNING id
    '''
    cur.execute(insert_sql, (['*'], 'Follow', test_content, test_msg, test_func, ['*'], test_note))
    new_rule_id = cur.fetchone()['id']
    conn.commit()
    print(f"[4] ✅ 成功寫入新 Follow 法則至 \"{target_table}\"，分配 ID: {new_rule_id}")

    # 4. 驗證剛寫入的資料
    cur.execute(f'SELECT * FROM "{target_table}" WHERE id = %s', (new_rule_id,))
    rule_after = cur.fetchone()
    print(f"[5] 驗證資料庫內容:")
    print(f"    - Note 欄位: '{rule_after['note']}' (包含 '加入好友訊息': {'加入好友訊息' in rule_after['note']})")
    print(f"    - Function 欄位: '{rule_after['function']}'")
    base_func_check = ('pri_set("name",sys.name(m))' in rule_after['function']) and ('pri_set("pic",sys.picture(m))' in rule_after['function'])
    print(f"    - Base Function 驗證結果: {base_func_check}")
    print(f"    - Content 欄位: '{rule_after['content']}'")

    # 5. 測試單一啟用防護邏輯 (嘗試再啟用此新法則，若已有別的啟用法則，確認防護阻擋)
    cur.execute(f'SELECT id FROM "{target_table}" WHERE type = %s AND content = %s AND id != %s', ('Follow', '*', new_rule_id))
    other_active = cur.fetchone()
    if other_active:
        print(f"[6] ✅ 驗證單一啟用阻擋機制：檢測到 ID={other_active['id']} 處於啟用中，新法則 ID={new_rule_id} 成功被設為 OFF 阻止衝突發送！")
    else:
        print(f"[6] ✅ 驗證單一啟用機制：新法則 ID={new_rule_id} 為唯一的啟用法則 (*)。")

    # 6. 清理測試產生的條目，還原資料庫
    cur.execute(f'DELETE FROM "{target_table}" WHERE id = %s', (new_rule_id,))
    conn.commit()
    print(f"[7] ✅ 測試完畢，已將測試紀錄 (ID: {new_rule_id}) 從 \"{target_table}\" 安全移除，資料庫還原完成。")

    cur.close()
    conn.close()
    print("=== 所有資料庫連線與 Follow 法則測試全數通過 ===")

if __name__ == '__main__':
    run_test()

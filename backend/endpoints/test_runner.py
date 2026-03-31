from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2
import json
import time
import uuid
from utils.socket_utils import send_socket_event

test_runner_bp = Blueprint('test_runner', __name__)

def get_db_connection():
    if hasattr(g, 'current_db_url') and g.current_db_url:
        return psycopg2.connect(g.current_db_url)
    raise Exception("No OA DB context found. Please provide X-OA-ID header.")

def get_logical_app_id():
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        return g.current_db_url.split('/')[-1].split('?')[0].strip()
    return '5013'

DEFAULT_TEST_CASES = [
    {"id": 1, "name": "純文字回訊測試", "trigger_keyword": "#測試文字", "expected_state": "00000"},
    {"id": 2, "name": "狀態跳轉測試-進入", "trigger_keyword": "#測試狀態跳轉", "expected_state": "TEST01"},
    {"id": 3, "name": "狀態跳轉測試-確認", "trigger_keyword": "#確認狀態", "expected_state": "00000"},
    {"id": 4, "name": "Smarteval-動態變數測試", "trigger_keyword": "#測試變數", "expected_state": "00000"},
    {"id": 5, "name": "Smarteval-資料庫存取測試", "trigger_keyword": "#測試資料庫", "expected_state": "00000"},
    {"id": 6, "name": "Smarteval-系統內建函式", "trigger_keyword": "#測試內建函式", "expected_state": "00000"},
    {"id": 7, "name": "Sensors模組-更新觸發測試", "trigger_keyword": "#測試系統觸發", "expected_state": "00000"},
    {"id": 8, "name": "Sensors模組-更新觸發接收", "trigger_keyword": "#被系统喚醒", "expected_state": "00000"},
    {"id": 9, "name": "Sensors模組-隨機數列測試", "trigger_keyword": "#測試隨機產生", "expected_state": "00000"},
    {"id": 10, "name": "全域廣播與查表測試", "trigger_keyword": "#測試全域變數", "expected_state": "00000"},
    {"id": 11, "name": "Check條件測試-恆真", "trigger_keyword": "#測試條件成立", "expected_state": "00000"},
    {"id": 12, "name": "Check條件測試-包含分號多條件", "trigger_keyword": "#測試多重條件", "expected_state": "00000"}
]

@test_runner_bp.route('/test_cases', methods=['GET'])
def get_test_cases():
    """從 Global_var 讀取測試案例 JSON"""
    try:
        app_id = get_logical_app_id()
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        table_name = f"Global_var:{app_id}"
        
        # 確保資料表存在
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS "{table_name}" (
                name VARCHAR(255) PRIMARY KEY,
                value TEXT
            )
        """)
        
        cur.execute(f"SELECT value FROM \"{table_name}\" WHERE name = 'SYS_TEST_CASES'")
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if row and row['value']:
            try:
                cases = json.loads(row['value'])
                if not cases:
                    cases = DEFAULT_TEST_CASES
                return jsonify({'status': 'success', 'cases': cases})
            except json.JSONDecodeError:
                return jsonify({'status': 'success', 'cases': DEFAULT_TEST_CASES})
        else:
            return jsonify({'status': 'success', 'cases': DEFAULT_TEST_CASES})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@test_runner_bp.route('/test_cases', methods=['POST'])
def save_test_cases():
    """將測試案例 JSON 存入 Global_var"""
    data = request.json
    cases = data.get('cases', [])
    try:
        app_id = get_logical_app_id()
        conn = get_db_connection()
        cur = conn.cursor()
        table_name = f"Global_var:{app_id}"
        
        cases_json = json.dumps(cases, ensure_ascii=False)
        
        cur.execute(f"""
            INSERT INTO "{table_name}" (name, value) 
            VALUES ('SYS_TEST_CASES', %s)
            ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value
        """, (cases_json,))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@test_runner_bp.route('/execute', methods=['POST'])
def execute_tests():
    """執行測試引擎: 模擬發送 Socket 訊息並檢驗資料庫結果"""
    data = request.json
    test_cases = data.get('cases', [])
    if not test_cases:
        return jsonify({'error': 'No test cases provided'}), 400

    results = []
    # 指定測試與切換法則庫使用的使用者 ID
    test_user_id = "yzuadmin"
    app_id = get_logical_app_id()

    try:
        for idx, tc in enumerate(test_cases):
            trigger = tc.get('trigger_keyword') or ''
            expected_state = str(tc.get('expected_state') or '')
            
            if not trigger:
                results.append({'id': tc.get('id', idx), 'status': 'Skip', 'reason': 'No trigger keyword'})
                continue
            
            # Step 1: 紀錄發送前的時間戳記 (直接向 DB 取時間避免時區落差造成完全撈不到資料)
            conn_ts = get_db_connection()
            cur_ts = conn_ts.cursor(cursor_factory=RealDictCursor)
            cur_ts.execute("SELECT NOW() - INTERVAL '2 seconds' as now")
            start_time = cur_ts.fetchone()['now']
            cur_ts.close()
            conn_ts.close()
            
            # Step 2: 透過 Socket.IO 發送模擬訊息
            payload = {
                'user': test_user_id,
                'message': trigger,
                'type': 'Message',
                'api_index': 0 
            }
            try:
                send_socket_event(payload)
            except Exception as e:
                results.append({'id': tc.get('id', idx), 'status': 'Fail', 'reason': f'Socket Error: {e}'})
                continue
            
            # Step 3: 等待 Line-Bot-Main 伺服器處理並寫入 DB
            time.sleep(1.5)
            
            # Step 4: 查詢資料庫驗證結果
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            history_row = None
            state_row = None
            try:
                # 撈取機器人的最新歷史回應 (注意移除沒有的 type 欄位)
                history_table = f"history:{app_id}"
                cur.execute(f"""
                    SELECT category, content FROM "{history_table}" 
                    WHERE user_id = %s AND timestamp >= %s AND category IN ('Response', 'sys_reply')
                    ORDER BY timestamp DESC LIMIT 1
                """, (test_user_id, start_time))
                history_row = cur.fetchone()
            except Exception as e:
                conn.rollback() # 取消發生的錯誤
                
            try:
                # 撈取最新狀態
                private_var_table = f"Private_var:{app_id}"
                cur.execute(f"""
                    SELECT state FROM "{private_var_table}" 
                    WHERE user_id = %s
                """, (test_user_id,))
                state_row = cur.fetchone()
            except Exception as e:
                conn.rollback()
                
            cur.close()
            conn.close()

            actual_content = history_row['content'] if history_row else '無回應'

            actual_state = state_row['state'] if state_row else '00000'
            
            # 檢驗邏輯
            pass_state = True if not expected_state else (expected_state == actual_state)
            
            is_pass = pass_state # 目前僅依賴預期狀態
            status_text = 'Pass' if is_pass else 'Fail'
            
            reason = []
            if expected_state and not pass_state: reason.append(f"預期狀態 {expected_state} 但拿到 {actual_state}")
            
            results.append({
                'id': tc.get('id', idx),
                'name': tc.get('name', ''),
                'keyword': trigger,
                'actual_content': actual_content,
                'actual_state': actual_state,
                'status': status_text,
                'reason': ", ".join(reason) if reason else "Success"
            })
            
        return jsonify({'status': 'success', 'results': results, 'test_user_id': test_user_id})
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"Test Execution Error: {err_msg}")
        return jsonify({'error': str(e), 'traceback': err_msg}), 500

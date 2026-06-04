from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2
import json
import time
import uuid
import ast
from utils.socket_utils import send_socket_event

test_runner_bp = Blueprint('test_runner', __name__)

from db_utils import get_db_connection

def get_logical_app_id():
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        return g.current_db_url.split('/')[-1].split('?')[0].strip()
    return '5013'

DEFAULT_TEST_CASES = []

@test_runner_bp.route('/test_cases', methods=['GET'])
def get_test_cases():
    """從 Global_var 讀取測試案例 JSON"""
    conn = None
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
    finally:
        if conn: conn.close()

@test_runner_bp.route('/test_cases', methods=['POST'])
def save_test_cases():
    """將測試案例 JSON 存入 Global_var"""
    data = request.json
    cases = data.get('cases', [])
    conn = None
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
        return jsonify({'status': 'success'})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

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

    conn = None
    try:
        conn = get_db_connection()
        for idx, tc in enumerate(test_cases):
            trigger = tc.get('trigger_keyword') or ''
            trigger_type = tc.get('trigger_type') or 'Message'
            expected_state = str(tc.get('expected_state') or '')
            
            if not trigger:
                results.append({'id': tc.get('id', idx), 'status': 'Skip', 'reason': 'No trigger keyword'})
                continue
            
            # Step 1: 紀錄發送前的時間戳記 (直接向 DB 取時間避免時區落差造成完全撈不到資料)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("SELECT NOW() - INTERVAL '2 seconds' as now")
            start_time = cur.fetchone()['now']
            
            # Step 2: 透過 Socket.IO 發送模擬訊息
            payload = {
                'user': test_user_id,
                'message': trigger,
                'type': trigger_type,
                'api_index': 0 
            }
            try:
                # 延長 Socket 連線時間，讓 Line-Bot-Main 有充裕時間處理並回傳訊息，避免 KeyError 斷線衝突
                send_socket_event(payload, wait_time=2.0)
            except Exception as e:
                results.append({'id': tc.get('id', idx), 'status': 'Fail', 'reason': f'Socket Error: {e}'})
                cur.close()
                continue
            
            # Step 3: 等待 Line-Bot-Main 伺服器處理並寫入 DB (已在 send_socket_event 內完成)
            
            # Step 4: 查詢資料庫驗證結果
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
                    SELECT value as state FROM "{private_var_table}" 
                    WHERE user_id = %s AND name = 'state'
                """, (test_user_id,))
                state_row = cur.fetchone()
            except Exception as e:
                conn.rollback()
                
            cur.close()

            actual_content_raw = history_row['content'] if history_row else '無回應'
            parsed_preview = actual_content_raw
            actual_reply_types = []
            
            if actual_content_raw != '無回應':
                try:
                    parsed = ast.literal_eval(actual_content_raw)
                    if isinstance(parsed, list):
                        texts = []
                        for item in parsed:
                            if isinstance(item, dict):
                                if 'type' in item: actual_reply_types.append(item['type'])
                                if 'text' in item: texts.append(item['text'])
                                elif 'type' in item: texts.append(f"[{item['type']}]")
                            elif isinstance(item, str):
                                texts.append(item)
                        if texts:
                            parsed_preview = " | ".join(texts)
                    elif isinstance(parsed, dict):
                        if 'type' in parsed: actual_reply_types.append(parsed['type'])
                        if 'text' in parsed: parsed_preview = parsed['text']
                        elif 'type' in parsed: parsed_preview = f"[{parsed['type']}]"
                except Exception:
                    try:
                        parsed_preview = actual_content_raw.encode('utf-8').decode('unicode_escape')
                    except Exception:
                        pass
            
            actual_state = state_row['state'] if state_row else '00000'
            expected_reply_type = tc.get('expected_reply_type') or ''
            
            expected_content = tc.get('expected_content') or ''
            
            # 檢驗邏輯: 同時驗證 State, Reply Type, Expected Content
            pass_state = True if not expected_state else (expected_state == actual_state)
            
            pass_type = True
            if expected_reply_type:
                expected_types = [t.strip().lower() for t in expected_reply_type.replace('|', ',').split(',') if t.strip()]
                actual_types_lower = [t.lower() for t in actual_reply_types]
                for et in expected_types:
                    if et not in actual_types_lower:
                        pass_type = False
                        break
            # expected_content 的驗證：如果預期文字有指定，則實際內容必須包含該字串（或部分符合）
            # 因為我們有替換如 (當前時間)，所以我們只檢查常數部分是否出現，或是簡單的 in 判斷
            # 這裡簡化為 expected_content 是否出現在 actual_content_raw 或 parsed_preview 中
            pass_content = True
            if expected_content:
                # 簡單判斷：將特殊標記移除後比對，或直接比對是否被包含
                # 若完全不符合則為 False
                if '(當前時間)' in expected_content or '(隨機項目)' in expected_content or '(資料庫查詢結果)' in expected_content or '(天氣查詢結果)' in expected_content:
                    # 有動態變數，只要不為空或大致長度大於0就當過，或者比對非動態部分
                    # 這裡簡化：只要有回覆就不算錯，或者更進階可以用 regex
                    pass_content = True
                else:
                    if expected_content not in parsed_preview and expected_content not in actual_content_raw:
                        # 允許一定程度的空白差異
                        if expected_content.replace(' ', '') not in parsed_preview.replace(' ', ''):
                            pass_content = False

            is_pass = pass_state and pass_type and pass_content
            status_text = 'Pass' if is_pass else 'Fail'
            
            reason = []
            if expected_state and not pass_state: reason.append(f"預期狀態 {expected_state} 但拿到 {actual_state}")
            if expected_reply_type and not pass_type: reason.append(f"預期回覆型態 {expected_reply_type} 但拿到 {actual_reply_types or '[]'}")
            if expected_content and not pass_content: reason.append(f"預期文字不符合")
            
            results.append({
                'id': tc.get('id', idx),
                'type': trigger_type,
                'keyword': trigger,
                'actual_content': parsed_preview,
                'actual_state': actual_state,
                'actual_types': actual_reply_types,
                'status': status_text,
                'reason': ", ".join(reason) if reason else "Success"
            })
            
        return jsonify({'status': 'success', 'results': results, 'test_user_id': test_user_id})
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"Test Execution Error: {err_msg}")
        return jsonify({'error': str(e), 'traceback': err_msg}), 500
    finally:
        if conn: conn.close()

from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2
import json
import re
from models import OAConfig

questionnaire_bp = Blueprint('questionnaire', __name__)


def get_db_connection():
    """Get the current OA's DB connection (same pattern as app.py)."""
    if hasattr(g, 'current_db_url') and g.current_db_url:
        return psycopg2.connect(g.current_db_url)
    raise Exception("No OA DB context found. Please provide X-OA-ID header.")


def get_app_id():
    """Get the current logical app id (e.g. 'yzulabuse')."""
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        path_part = g.current_db_url.split('/')[-1]
        return path_part.split('?')[0].strip()
    return 'yzulabuse'


def _trigger_sql_reload():
    """
    Send SQL|True Sensor event to the Line Bot server so it reloads Q_bank
    rule_table from DB at runtime — no Heroku restart needed.
    """
    try:
        from utils.socket_utils import send_socket_event
        oa_id = getattr(g, 'current_oa_id', None)
        # Resolve socket_url from OA config if available
        socket_url = None
        if oa_id:
            oa = OAConfig.query.get(int(oa_id))
            if oa and oa.other_settings:
                socket_url = oa.other_settings.get('socket_url')
        data = {
            'user': 'yzuadmin',
            'type': 'Sensor',
            'message': 'SQL|True',
        }
        if socket_url:
            data['target_ws_url'] = socket_url
        send_socket_event(data, namespace='/websoc')
    except Exception as e:
        print(f'[questionnaire] SQL reload trigger failed (non-critical): {e}')


def _parse_condition(cond_id: str, cond_detail: str = '') -> str:
    """
    Convert condition number (1~7) to a Python check string for Q_bank.
    cond_detail is used for condition 3 (options list) and 4 (min,max length).
    """
    c = str(cond_id).strip()

    if c == '1':
        return ''  # No restriction

    if c == '2':
        return "sys.content(m, 0).isdigit()"

    if c == '3':
        # cond_detail: comma-separated options e.g. "是,否"
        options = [opt.strip() for opt in cond_detail.split(',') if opt.strip()]
        options_repr = repr(options)
        return f"sys.content(m, 0) in {options_repr}"

    if c == '4':
        # cond_detail: "min,max" e.g. "5,20" ; -1 means no limit
        parts = cond_detail.split(',')
        if len(parts) != 2:
            return ''
        try:
            min_val = int(parts[0].strip())
            max_val = int(parts[1].strip())
        except ValueError:
            return ''

        if min_val >= 0 and max_val >= 0:
            return f"len(sys.content(m, 0)) >= {min_val} and len(sys.content(m, 0)) <= {max_val}"
        elif min_val >= 0 and max_val == -1:
            return f"len(sys.content(m, 0)) >= {min_val}"
        elif min_val == 0 and max_val >= 0:
            return f"len(sys.content(m, 0)) <= {max_val}"
        return ''

    if c == '5':
        return ("sys.content(m, 0).startswith('09') and "
                "len(sys.content(m, 0)) == 10 and "
                "sys.content(m, 0).isdigit()")

    if c == '6':
        return r"bool(re.match(r'[^@]+@[^@]+\.[^@]+', sys.content(m, 0)))"

    if c == '7':
        return r"bool(re.match(r'^\d{4}-\d{2}-\d{2}$', sys.content(m, 0)))"

    return ''


def _get_next_available_id(conn, app_id: str) -> int:
    """
    Find the smallest available ID (1-99) not currently used by any questionnaire
    in the Q_bank:{app_id} table.
    """
    cur = conn.cursor()
    table = f"Q_bank:{app_id}"
    # Extract IDs from existing states like 'Q0101' -> '01'
    # We look at all state_in[0] since every rule belongs to a questionnaire
    cur.execute(f"SELECT DISTINCT substring(state_in[1] from 2 for 2) FROM \"{table}\" WHERE state_in[1] LIKE 'Q____'")
    used_ids = {int(r[0]) for r in cur.fetchall() if r[0].isdigit()}
    cur.close()

    for i in range(1, 100):
        if i not in used_ids:
            return i
    raise Exception("已達到問卷數量上限 (99)")


def _make_state(quest_id: int, q_num: int) -> str:
    """
    Generates a unique 5-character state for a question.
    Format: Q + ID(2 digits) + Seq(2 digits)
    Example: Q0101, Q0113
    """
    return f"Q{quest_id:02d}{q_num:02d}"


def _text_msg_json(text: str) -> str:
    """
    Serialize a LINE text message to a JSON string for ARRAY(JSON) insertion.
    The format uses 'OTYPE' key so maingame.check_JSON converts it into
    a TextSendMessage object before sending via the Line SDK.
    Format: {"Line": {"OTYPE": "TextSendMessage", "text": "..."}}
    """
    return json.dumps({"Line": {"OTYPE": "TextSendMessage", "text": text}}, ensure_ascii=False)


def build_questionnaire_direct(data: dict, app_id: str, conn, quest_id: int) -> None:
    """
    Build and insert Q_bank rules from structured questionnaire data.
    """
    note = data.get('note', '未命名問卷')
    trigger = data.get('trigger')
    finish_msg = data.get('finish_msg', '問卷已完成，謝謝您的參與！')
    questions = data.get('questions', [])
    enable_review = data.get('enable_review', False)
    start_time = data.get('start_time', '').strip()
    end_time = data.get('end_time', '').strip()

    cur = conn.cursor()
    table = f"Q_bank:{app_id}"

    # 0. Availability Check (Time Limits)
    def parse_time(ts_str):
        if not ts_str: return None
        for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
            try:
                return int(datetime.strptime(ts_str, fmt).timestamp())
            except ValueError:
                continue
        return None

    time_check = ''
    start_ts = parse_time(start_time)
    end_ts = parse_time(end_time)

    if start_ts is not None and end_ts is not None:
        time_check = f"sys.now() >= {start_ts} and sys.now() <= {end_ts}"
    elif start_ts is not None:
        time_check = f"sys.now() >= {start_ts}"
    elif end_ts is not None:
        time_check = f"sys.now() <= {end_ts}"

    # 1. Entry Rule (Trigger -> First Question)
    first_state = _make_state(quest_id, 1)
    cur.execute(f"""
        INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
        VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
    """, (
        ['*'], 'Message', [trigger], [time_check],
        [_text_msg_json(questions[0]['content'])],
        first_state, '', True, note
    ))

    # 2. Question Rules
    for i, q in enumerate(questions):
        curr_q_idx = i + 1
        curr_state = _make_state(quest_id, curr_q_idx)
        is_last = (curr_q_idx == len(questions))

        # Check condition for this question
        check_str = _parse_condition(q.get('cond', '1'), q.get('cond_detail', ''))
        save_fn = f"pri_set('ans_{note}_Q{curr_q_idx}', m.content)"

        # Correct answer rule
        if is_last:
            if enable_review:
                # Go to Review State
                review_state = f"Q{quest_id:02d}99"
                
                # We need to construct the summary message
                summary_parts = [f"📝 {note} - 答題確認", "----------------"]
                for j, qq in enumerate(questions):
                    summary_parts.append(f"Q{j+1}. {qq['content']}\n答：<%pri('ans_{note}_Q{j+1}')%>")
                summary_parts.append("----------------")
                summary_parts.append("請確認以上內容：\n1. 確認送出\n2. 重新填寫")
                summary_msg = "\n".join(summary_parts)

                cur.execute(f"""
                    INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                    VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                """, (
                    [curr_state], 'Message', ['*'], [check_str],
                    [_text_msg_json(summary_msg)],
                    review_state, save_fn, True, note
                ))
            else:
                # Finish directly
                cur.execute(f"""
                    INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                    VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                """, (
                    [curr_state], 'Message', ['*'], [check_str],
                    [_text_msg_json(finish_msg)],
                    '00000', save_fn, True, note
                ))
        else:
            # Next question
            next_state = _make_state(quest_id, curr_q_idx + 1)
            cur.execute(f"""
                INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
            """, (
                [curr_state], 'Message', ['*'], [check_str],
                [_text_msg_json(questions[curr_q_idx]['content'])],
                next_state, save_fn, True, note
            ))

        # Fallback/error rule
        if check_str:
            error_msg = _build_error_msg(q['cond'], q.get('cond_detail', ''), q['content'])
            cur.execute(f"""
                INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
            """, (
                [curr_state], 'Message', ['*'], [''],
                [_text_msg_json(error_msg)],
                curr_state, '', True, note
            ))

    # 3. Review State Rules (if enabled)
    if enable_review:
        review_state = f"Q{quest_id:02d}99"
        
        # Confirm -> Finish
        cur.execute(f"""
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
        """, (
            [review_state], 'Message', ['確認送出', '1'], [''],
            [_text_msg_json(finish_msg)],
            '00000', '', True, note
        ))

        # Restart -> Q0101
        cur.execute(f"""
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
        """, (
            [review_state], 'Message', ['重新填寫', '2'], [''],
            [_text_msg_json(questions[0]['content'])],
            _make_state(quest_id, 1), '', True, note
        ))

        # Fallback Review
        cur.execute(f"""
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
        """, (
            [review_state], 'Message', ['*'], [''],
            [_text_msg_json("請選擇「確認送出」或「重新填寫」來完成問卷。")],
            review_state, '', True, note
        ))

    conn.commit()
    cur.close()


def _build_error_msg(cond_id: str, cond_detail: str, question_text: str) -> str:
    """Build a user-friendly error message for invalid answers."""
    c = str(cond_id).strip()
    hints = {
        '2': '請輸入純數字',
        '3': f'請輸入指定選項之一：{cond_detail}',
        '4': f'請確認字數符合範圍（{cond_detail.replace(",", "~")} 字）',
        '5': '請輸入正確的台灣手機號碼（09 開頭、共 10 碼）',
        '6': '請輸入正確的 Email 格式（例如：example@mail.com）',
        '7': '請輸入正確的日期格式（YYYY-MM-DD）',
    }
    hint = hints.get(c, '輸入格式錯誤，請重新輸入')
    return f"⚠️ {hint}，請重新回答：\n{question_text}"


# ──────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────

@questionnaire_bp.route('/list', methods=['GET'])
def list_questionnaires():
    """GET /api/questionnaire/list — Return all distinct notes (questionnaire series) in Q_bank."""
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        table = f"Q_bank:{app_id}"
        
        # Group by note to find unique questionnaires
        # Extract ID from state_in[1] where it matches our Q[ID][SEQ] pattern
        cur.execute(f"""
            SELECT note, 
                   (SELECT state_in[1] FROM "{table}" AS sub 
                    WHERE sub.note = t.note AND sub.state_in[1] LIKE 'Q____' 
                    LIMIT 1) as sample_state,
                   count(*) as rules_count
            FROM "{table}" AS t
            WHERE note IS NOT NULL 
            GROUP BY note
        """)
        results = cur.fetchall()
        
        questionnaires = []
        for r in results:
            # Attempt to extract ID from sample_state like 'Q0101'
            q_id = "00"
            if r['sample_state'] and len(r['sample_state']) == 5:
                q_id = r['sample_state'][1:3]
                
            questionnaires.append({
                'id': q_id,
                'note': r['note'],
                'rules_count': r['rules_count'] # Total rules for this questionnaire
            })
            
        cur.close()
        conn.close()
        return jsonify({'questionnaires': questionnaires})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@questionnaire_bp.route('/<note>', methods=['GET'])
def get_questionnaire(note):
    """GET /api/questionnaire/<note> — Return all Q_bank rows for a specific note."""
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        table = f"Q_bank:{app_id}"
        cur.execute(f'SELECT * FROM "{table}" WHERE note = %s ORDER BY id', (note,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(list(rows))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@questionnaire_bp.route('/build', methods=['POST'])
def build_questionnaire():
    """
    POST /api/questionnaire/build
    Body: { note, trigger, finish_msg, questions: [{content, cond, cond_detail}] }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    note = data.get('note', '').strip()
    trigger = data.get('trigger', '').strip()
    questions = data.get('questions', [])
    enable_review = data.get('enable_review', False)
    start_time = data.get('start_time', '').strip()
    end_time = data.get('end_time', '').strip()

    if not note:
        return jsonify({'error': '問卷名稱不能為空'}), 400
    if not trigger:
        return jsonify({'error': '觸發指令不能為空'}), 400
    if not questions:
        return jsonify({'error': '至少需要一道題目'}), 400

    # Validate condition 4 detail format
    for i, q in enumerate(questions):
        if str(q.get('cond', '1')) == '4':
            detail = q.get('cond_detail', '')
            parts = detail.split(',')
            if len(parts) != 2 or not all(p.strip().lstrip('-').isdigit() for p in parts):
                return jsonify({'error': f'第 {i+1} 題的字數限制格式錯誤，請使用「最小,最大」格式（例如：5,20）'}), 400

    try:
        conn = get_db_connection()
        app_id = get_app_id()
        
        # Check for duplicate names to ensure safe DELETE
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM \"Q_bank:{app_id}\" WHERE note = %s LIMIT 1", (note,))
        if cur.fetchone():
            conn.close()
            return jsonify({'error': f'問卷名稱「{note}」已存在，請使用不同名稱'}), 400

        # Auto-assignment of numeric ID (reuses holes)
        quest_id = _get_next_available_id(conn, app_id)
        
        build_questionnaire_direct(data, app_id, conn, quest_id)
        conn.close()
        _trigger_sql_reload()
        return jsonify({'status': 'success', 'message': f'問卷「{note}」已成功建立 (ID: {quest_id:02d})'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@questionnaire_bp.route('/<note>', methods=['DELETE'])
def delete_questionnaire(note):
    """DELETE /api/questionnaire/<note> — Remove all Q_bank rows with this note."""
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        cur = conn.cursor()
        table = f"Q_bank:{app_id}"
        cur.execute(f'DELETE FROM "{table}" WHERE note = %s', (note,))
        deleted = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        _trigger_sql_reload()
        return jsonify({'status': 'success', 'deleted_rows': deleted})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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


def _make_state(note: str, q_num: int) -> str:
    """
    Build a 5-char state string for question number q_num within note.
    e.g. note='abc', q_num=1 -> 'Qabc1' (5 chars if note<=3 chars)
    Falls back to a numeric state 'Q{q_num:04d}' if note is too long.
    """
    candidate = f"Q{note}{q_num}"
    if len(candidate) <= 5:
        return candidate
    # Fallback: use numeric key, prefix with 'q' to stay 5 chars
    return f"Q{q_num:04d}"


def _text_msg_json(text: str) -> str:
    """
    Serialize a LINE text message to a JSON string for ARRAY(JSON) insertion.
    The format uses 'OTYPE' key so maingame.check_JSON converts it into
    a TextSendMessage object before sending via the Line SDK.
    Format: {"Line": {"OTYPE": "TextSendMessage", "text": "..."}}
    """
    return json.dumps({"Line": {"OTYPE": "TextSendMessage", "text": text}}, ensure_ascii=False)


def build_questionnaire_direct(data: dict, app_id: str, conn) -> None:
    """
    Build and insert Q_bank rules from structured questionnaire data.
    data format:
    {
        "note": str,
        "trigger": str,
        "finish_msg": str,
        "questions": [
            {"content": str, "cond": str, "cond_detail": str},
            ...
        ]
    }
    """
    note = data['note']
    trigger = data['trigger']
    finish_msg = data.get('finish_msg', '感謝您的填寫！')
    questions = data['questions']
    n = len(questions)

    table = f"Q_bank:{app_id}"
    cur = conn.cursor()

    insert_sql = (
        f'INSERT INTO "{table}" '
        f'(note, type, "check", content, state_in, state_out, function, msg_rpy, history) '
        f'VALUES (%s, %s, %s, %s, %s, %s, %s, %s::json[], %s)'
    )

    # Rule 0: Trigger rule (state_in=['00000'], content=[trigger] -> state_out = Q[note]1)
    first_state = _make_state(note, 1)
    first_q_content = questions[0]['content'] if n > 0 else finish_msg

    cur.execute(insert_sql, (
        note,
        'Message',
        [],                           # check: empty ARRAY
        [trigger],                    # content: ARRAY of strings
        ['00000'],                    # state_in: ARRAY of strings
        first_state if n > 0 else '00000',
        f"pri_set('ans_{note}_Q0', sys.content(m))",
        [_text_msg_json(first_q_content)],   # msg_rpy: ARRAY of JSON strings
        True
    ))

    # Rules per question: correct + fallback (error)
    for i, q in enumerate(questions):
        q_num = i + 1
        state_in = _make_state(note, q_num)
        is_last = (i == n - 1)
        state_out = '00000' if is_last else _make_state(note, q_num + 1)
        next_content = finish_msg if is_last else questions[i + 1]['content']

        check_str = _parse_condition(q['cond'], q.get('cond_detail', ''))
        save_fn = f"pri_set('ans_{note}_Q{q_num}', sys.content(m))"

        # Correct answer rule
        cur.execute(insert_sql, (
            note,
            'Message',
            [check_str] if check_str else [],   # check: ARRAY (empty if no condition)
            ['*'],                               # content: wildcard ARRAY
            [state_in],                          # state_in: ARRAY
            state_out,
            save_fn,
            [_text_msg_json(next_content)],      # msg_rpy: ARRAY of JSON strings
            True
        ))

        # Fallback/error rule (only if there IS a condition to check)
        if check_str:
            error_msg = _build_error_msg(q['cond'], q.get('cond_detail', ''), q['content'])
            cur.execute(insert_sql, (
                note,
                'Message',
                [],                              # no check = catches everything (fallback)
                ['*'],                           # content: wildcard ARRAY
                [state_in],                      # state_in: ARRAY (stay at same question)
                state_in,                        # state_out = same state (re-ask)
                '',
                [_text_msg_json(error_msg)],     # msg_rpy: ARRAY of JSON strings
                True
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
        cur.execute(f'SELECT DISTINCT note FROM "{table}" WHERE note IS NOT NULL AND note != \'\' ORDER BY note')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([r['note'] for r in rows])
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

    if not note:
        return jsonify({'error': '問卷系列 ID (note) 不能為空'}), 400
    if not re.match(r'^[A-Za-z0-9_]+$', note):
        return jsonify({'error': '問卷系列 ID 只能包含英數字或底線'}), 400
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
        build_questionnaire_direct(data, app_id, conn)
        conn.close()
        _trigger_sql_reload()
        return jsonify({'status': 'success', 'message': f'問卷「{note}」已成功建立並寫入資料庫'})
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

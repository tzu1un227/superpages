from datetime import datetime
import json
import re

import psycopg2
from flask import Blueprint, g, jsonify, request
from psycopg2.extras import RealDictCursor

from models import OAConfig

questionnaire_bp = Blueprint("questionnaire", __name__)


from db_utils import get_db_connection


def get_app_id():
    if hasattr(g, "current_app_name") and g.current_app_name:
        return g.current_app_name
    if hasattr(g, "current_db_url") and g.current_db_url:
        path_part = g.current_db_url.split("/")[-1]
        return path_part.split("?")[0].strip()
    return "yzulabuse"


def _trigger_sql_reload():
    try:
        from utils.socket_utils import send_socket_event

        oa_id = getattr(g, "current_oa_id", None)
        socket_url = None
        if oa_id:
            oa = OAConfig.query.get(int(oa_id))
            if oa and oa.other_settings:
                socket_url = oa.other_settings.get("socket_url")

        data = {
            "user": "yzuadmin",
            "type": "Sensor",
            "message": "SQL|True",
        }
        if socket_url:
            data["target_ws_url"] = socket_url
        send_socket_event(data, namespace="/websoc")
    except Exception as e:
        print(f"[questionnaire] SQL reload trigger failed (non-critical): {e}")


def _table_names(app_id):
    return {
        "q_bank": f'Q_bank:{app_id}',
        "private_var": f'Private_var:{app_id}',
        "groups": f'questionnaire_groups:{app_id}',
        "meta": f'questionnaire_meta:{app_id}',
    }


def _ensure_questionnaire_tables(conn, app_id):
    tables = _table_names(app_id)
    cur = conn.cursor()
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{tables["groups"]}" (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{tables["meta"]}" (
            note TEXT PRIMARY KEY,
            group_id INTEGER NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    conn.commit()
    cur.close()


def _escape_like(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _parse_condition(cond_id, cond_detail=""):
    cond_id = str(cond_id).strip()

    if cond_id == "1":
        return ""
    if cond_id == "2":
        return "sys.content(m, 0).isdigit()"
    if cond_id == "3":
        options = [opt.strip() for opt in cond_detail.split(",") if opt.strip()]
        return f"sys.content(m, 0) in {repr(options)}"
    if cond_id == "4":
        parts = cond_detail.split(",")
        if len(parts) != 2:
            return ""
        try:
            min_val = int(parts[0].strip())
            max_val = int(parts[1].strip())
        except ValueError:
            return ""
        rules = []
        if min_val >= 0:
            rules.append(f"len(sys.content(m, 0)) >= {min_val}")
        if max_val >= 0:
            rules.append(f"len(sys.content(m, 0)) <= {max_val}")
        return " and ".join(rules)
    if cond_id == "5":
        return (
            "sys.content(m, 0).startswith('09') and "
            "len(sys.content(m, 0)) == 10 and "
            "sys.content(m, 0).isdigit()"
        )
    if cond_id == "6":
        return r"bool(re.match(r'[^@]+@[^@]+\.[^@]+', sys.content(m, 0)))"
    if cond_id == "7":
        return r"bool(re.match(r'^\d{4}-\d{2}-\d{2}$', sys.content(m, 0)))"
    return ""


def _parse_condition_from_check(check_str):
    check_str = check_str or ""
    cond = "1"
    cond_detail = ""

    if "isdigit()" in check_str:
        cond = "2"
    elif "sys.content(m, 0) in" in check_str:
        cond = "3"
        match = re.search(r"in \[(.*)\]", check_str)
        if match:
            cond_detail = match.group(1).replace("'", "").replace(" ", "")
    elif "len(sys.content(m, 0))" in check_str:
        cond = "4"
        min_match = re.search(r">= (\d+)", check_str)
        max_match = re.search(r"<= (\d+)", check_str)
        min_val = min_match.group(1) if min_match else "0"
        max_val = max_match.group(1) if max_match else "-1"
        cond_detail = f"{min_val},{max_val}"
    elif "startswith('09')" in check_str:
        cond = "5"
    elif "[^@]+@[^@]+" in check_str or "@" in check_str:
        cond = "6"
    elif r"^\d{4}-\d{2}-\d{2}$" in check_str:
        cond = "7"

    return cond, cond_detail


def _get_next_available_id(conn, app_id):
    table = _table_names(app_id)["q_bank"]
    cur = conn.cursor()
    cur.execute(
        f'SELECT DISTINCT substring(state_in[1] from 2 for 2) FROM "{table}" WHERE state_in[1] LIKE %s',
        ("Q____",),
    )
    used_ids = {int(row[0]) for row in cur.fetchall() if row[0] and row[0].isdigit()}
    cur.close()

    for i in range(1, 100):
        if i not in used_ids:
            return i
    raise Exception("已達到問卷數量上限 (99)")


def _make_state(quest_id, q_num):
    return f"Q{quest_id:02d}{q_num:02d}"


def _text_msg_json(text):
    return json.dumps({"Line": {"OTYPE": "TextSendMessage", "text": text}}, ensure_ascii=False)


def _extract_text_from_msg(msg_item):
    if msg_item is None:
        return ""
    if isinstance(msg_item, str):
        try:
            msg_item = json.loads(msg_item)
        except Exception:
            return msg_item
    if isinstance(msg_item, dict):
        if "Line" in msg_item and isinstance(msg_item["Line"], dict):
            return str(msg_item["Line"].get("text", ""))
        return str(msg_item.get("text", ""))
    return str(msg_item)


def _extract_tags_from_fn(fn_str):
    if not fn_str:
        return []
    
    tags = []
    # Support new format: pri_push('tag','...')
    push_tags = re.findall(r"pri_push\('tag','(.*?)'\)", fn_str)
    if push_tags:
        tags.extend(push_tags)

    # Support legacy format: set_tag|...
    if "set_tag|" in fn_str:
        parts = fn_str.split("set_tag|")
        if len(parts) > 1:
            tags_part = parts[1].split(";")[0]
            tags.extend([t for t in tags_part.split("|") if t.strip()])
            
    return list(dict.fromkeys(tags))


def _parse_time(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return int(datetime.strptime(value, fmt).timestamp())
        except ValueError:
            continue
    return None


def _parse_time_bounds(check_str):
    start_time = ""
    end_time = ""
    if check_str:
        start_match = re.findall(r">= (\d+)", check_str)
        end_match = re.findall(r"<= (\d+)", check_str)
        if start_match:
            start_time = datetime.fromtimestamp(int(start_match[0])).strftime("%Y-%m-%dT%H:%M")
        if end_match:
            end_time = datetime.fromtimestamp(int(end_match[0])).strftime("%Y-%m-%dT%H:%M")
    return start_time, end_time


def _build_error_msg(cond_id, cond_detail, question_text):
    hints = {
        "2": "請輸入純數字。",
        "3": f"請輸入指定選項之一：{cond_detail}",
        "4": f"請輸入符合字數限制的內容：{cond_detail.replace(',', ' ~ ')}",
        "5": "請輸入正確手機格式，例如 09 開頭且共 10 碼。",
        "6": "請輸入正確 Email 格式，例如 example@mail.com。",
        "7": "請輸入正確日期格式，例如 YYYY-MM-DD。",
    }
    hint = hints.get(str(cond_id).strip(), "輸入格式不正確，請重新作答。")
    return f"{hint}\n{question_text}"


def _upsert_questionnaire_meta(conn, app_id, note, group_id):
    table = _table_names(app_id)["meta"]
    cur = conn.cursor()
    cur.execute(
        f'''
        INSERT INTO "{table}" (note, group_id, created_at, updated_at)
        VALUES (%s, %s, NOW(), NOW())
        ON CONFLICT (note)
        DO UPDATE SET group_id = EXCLUDED.group_id, updated_at = NOW()
        ''',
        (note, group_id),
    )
    cur.close()


def _load_questionnaire_rows(conn, app_id, note):
    table = _table_names(app_id)["q_bank"]
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f'SELECT * FROM "{table}" WHERE note = %s ORDER BY id', (note,))
    rows = cur.fetchall()
    cur.close()
    return rows


def _extract_questionnaire_questions(rows):
    entry_rule = next((row for row in rows if "*" in (row.get("state_in") or [])), None)
    if not entry_rule:
        raise Exception("問卷資料不完整：遺失入口規則")

    question_rules = []
    seen_states = set()
    for row in rows:
        state_in = (row.get("state_in") or [""])[0]
        if not state_in.startswith("Q") or state_in.endswith("99"):
            continue
        if state_in in seen_states:
            continue
        seen_states.add(state_in)
        question_rules.append(row)
    question_rules.sort(key=lambda row: int((row["state_in"][0])[3:5]))

    questions = []
    first_text = _extract_text_from_msg((entry_rule.get("msg_rpy") or [None])[0])
    if first_text:
        questions.append({"content": first_text, "cond": "1", "cond_detail": "", "tags": []})

    for index, row in enumerate(question_rules):
        check_str = (row.get("check") or [""])[0]
        fn_str = (row.get("function") or "")
        cond, cond_detail = _parse_condition_from_check(check_str)
        tags = _extract_tags_from_fn(fn_str)
        
        if index < len(questions):
            questions[index]["cond"] = cond
            questions[index]["cond_detail"] = cond_detail
            questions[index]["tags"] = tags

        next_text = _extract_text_from_msg((row.get("msg_rpy") or [None])[0])
        if index < len(question_rules) - 1 and next_text:
            questions.append({"content": next_text, "cond": "1", "cond_detail": "", "tags": []})

    return entry_rule, questions


def build_questionnaire_direct(data, app_id, conn, quest_id):
    note = data.get("note", "未命名問卷")
    trigger = data.get("trigger", "").strip()
    finish_msg = data.get("finish_msg", "問卷已完成，謝謝您的參與！")
    questions = data.get("questions", [])
    enable_review = bool(data.get("enable_review", False))
    start_time = data.get("start_time", "").strip()
    end_time = data.get("end_time", "").strip()

    table = _table_names(app_id)["q_bank"]
    cur = conn.cursor()

    start_ts = _parse_time(start_time)
    end_ts = _parse_time(end_time)
    time_check = ""
    if start_ts is not None and end_ts is not None:
        time_check = f"sys.now() >= {start_ts} and sys.now() <= {end_ts}"
    elif start_ts is not None:
        time_check = f"sys.now() >= {start_ts}"
    elif end_ts is not None:
        time_check = f"sys.now() <= {end_ts}"

    first_state = _make_state(quest_id, 1)
    cur.execute(
        f'''
        INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
        VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
        ''',
        (
            ["*"],
            "Message",
            [trigger],
            [time_check],
            [_text_msg_json(questions[0]["content"])],
            first_state,
            "",
            True,
            note,
        ),
    )

    for i, question in enumerate(questions):
        current_index = i + 1
        current_state = _make_state(quest_id, current_index)
        is_last = current_index == len(questions)

        check_str = _parse_condition(question.get("cond", "1"), question.get("cond_detail", ""))
        save_fn = f"pri_set('ans_{note}_Q{current_index}', m.content)"
        
        tags = question.get("tags")
        if tags and isinstance(tags, list):
            for t in tags:
                tag = str(t).strip()
                if tag:
                    save_fn += f",pri_push('tag','{tag}')"

        if is_last:
            if enable_review:
                review_state = f"Q{quest_id:02d}99"
                summary_lines = [f"【{note}】作答回顧", "----------------"]
                for j, q in enumerate(questions, start=1):
                    summary_lines.append(f"Q{j}. {q['content']}\n答案：<%pri('ans_{note}_Q{j}')%>")
                summary_lines.append("----------------")
                summary_lines.append("請輸入：\n1. 確認送出\n2. 重新填寫")
                cur.execute(
                    f'''
                    INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                    VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                    ''',
                    (
                        [current_state],
                        "Message",
                        ["*"],
                        [check_str],
                        [_text_msg_json("\n".join(summary_lines))],
                        review_state,
                        save_fn,
                        True,
                        note,
                    ),
                )
            else:
                cur.execute(
                    f'''
                    INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                    VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                    ''',
                    (
                        [current_state],
                        "Message",
                        ["*"],
                        [check_str],
                        [_text_msg_json(finish_msg)],
                        "00000",
                        save_fn,
                        True,
                        note,
                    ),
                )
        else:
            next_state = _make_state(quest_id, current_index + 1)
            cur.execute(
                f'''
                INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                ''',
                (
                    [current_state],
                    "Message",
                    ["*"],
                    [check_str],
                    [_text_msg_json(questions[current_index]["content"])],
                    next_state,
                    save_fn,
                    True,
                    note,
                ),
            )

        if check_str:
            cur.execute(
                f'''
                INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
                VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
                ''',
                (
                    [current_state],
                    "Message",
                    ["*"],
                    [""],
                    [_text_msg_json(_build_error_msg(question.get("cond", "1"), question.get("cond_detail", ""), question["content"]))],
                    current_state,
                    "",
                    True,
                    note,
                ),
            )

    if enable_review:
        review_state = f"Q{quest_id:02d}99"
        cur.execute(
            f'''
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
            ''',
            (
                [review_state],
                "Message",
                ["確認送出", "1"],
                [""],
                [_text_msg_json(finish_msg)],
                "00000",
                "",
                True,
                note,
            ),
        )
        cur.execute(
            f'''
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
            ''',
            (
                [review_state],
                "Message",
                ["重新填寫", "2"],
                [""],
                [_text_msg_json(questions[0]["content"])],
                _make_state(quest_id, 1),
                "",
                True,
                note,
            ),
        )
        cur.execute(
            f'''
            INSERT INTO "{table}" (state_in, type, content, "check", msg_rpy, state_out, function, history, note)
            VALUES (%s, %s, %s, %s, %s::json[], %s, %s, %s, %s)
            ''',
            (
                [review_state],
                "Message",
                ["*"],
                [""],
                [_text_msg_json("請輸入「確認送出」或「重新填寫」來完成問卷。")],
                review_state,
                "",
                True,
                note,
            ),
        )

    conn.commit()
    cur.close()


@questionnaire_bp.route("/groups", methods=["GET"], strict_slashes=False)
def list_questionnaire_groups():
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT g.id, g.name, g.created_at, COUNT(m.note) AS questionnaire_count
            FROM "{tables["groups"]}" g
            LEFT JOIN "{tables["meta"]}" m ON m.group_id = g.id
            GROUP BY g.id, g.name, g.created_at
            ORDER BY g.name
            '''
        )
        groups = cur.fetchall()
        cur.close()
        return jsonify({"groups": groups})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/groups", methods=["POST"], strict_slashes=False)
def create_questionnaire_group():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "群組名稱不能為空"}), 400

    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        table = _table_names(app_id)["groups"]
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f'INSERT INTO "{table}" (name) VALUES (%s) RETURNING id, name, created_at', (name,))
        group = cur.fetchone()
        conn.commit()
        cur.close()
        return jsonify({"status": "success", "group": group})
    except psycopg2.errors.UniqueViolation:
        if conn:
            conn.rollback()
        return jsonify({"error": "群組名稱已存在"}), 400
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/groups/<int:group_id>", methods=["DELETE"], strict_slashes=False)
def delete_questionnaire_group(group_id):
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)
        cur = conn.cursor()
        cur.execute(f'SELECT COUNT(*) FROM "{tables["meta"]}" WHERE group_id = %s', (group_id,))
        questionnaire_count = cur.fetchone()[0]
        if questionnaire_count > 0:
            cur.close()
            return jsonify({"error": "此群組仍有問卷，請先移除或改到其他群組"}), 400

        cur.execute(f'DELETE FROM "{tables["groups"]}" WHERE id = %s', (group_id,))
        deleted = cur.rowcount
        conn.commit()
        cur.close()
        return jsonify({"status": "success", "deleted_rows": deleted})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/list", methods=["GET"], strict_slashes=False)
def list_questionnaires():
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT
                t.note,
                (SELECT state_in[1] FROM "{tables["q_bank"]}" sub WHERE sub.note = t.note AND sub.state_in[1] LIKE 'Q____' LIMIT 1) AS sample_state,
                (SELECT "check"[1] FROM "{tables["q_bank"]}" sub WHERE sub.note = t.note AND sub.state_in @> ARRAY['*'] LIMIT 1) AS entry_check,
                EXISTS(SELECT 1 FROM "{tables["q_bank"]}" sub WHERE sub.note = t.note AND sub.state_out LIKE 'Q__99') AS has_review,
                COUNT(*) AS rules_count,
                meta.group_id,
                grp.name AS group_name
            FROM "{tables["q_bank"]}" AS t
            LEFT JOIN "{tables["meta"]}" meta ON meta.note = t.note
            LEFT JOIN "{tables["groups"]}" grp ON grp.id = meta.group_id
            WHERE t.note IS NOT NULL
            GROUP BY t.note, meta.group_id, grp.name
            ORDER BY COALESCE(grp.name, '未分組'), t.note
            '''
        )
        rows = cur.fetchall()
        questionnaires = []
        for row in rows:
            q_id = "00"
            if row["sample_state"] and len(row["sample_state"]) == 5:
                q_id = row["sample_state"][1:3]
            start_time, end_time = _parse_time_bounds(row.get("entry_check") or "")
            questionnaires.append(
                {
                    "id": q_id,
                    "note": row["note"],
                    "rules_count": row["rules_count"],
                    "enable_review": row["has_review"],
                    "start_time": start_time,
                    "end_time": end_time,
                    "group_id": row["group_id"],
                    "group_name": row["group_name"] or "未分組",
                }
            )
        cur.close()
        return jsonify({"questionnaires": questionnaires})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/detail/<note>", methods=["GET"], strict_slashes=False)
def get_questionnaire_detail(note):
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)
        rows = _load_questionnaire_rows(conn, app_id, note)
        if not rows:
            return jsonify({"error": "找不到該問卷"}), 404

        entry_rule, questions = _extract_questionnaire_questions(rows)
        trigger = (entry_rule.get("content") or [""])[0]
        start_time, end_time = _parse_time_bounds((entry_rule.get("check") or [""])[0] if entry_rule.get("check") else "")
        enable_review = any((row.get("state_out") or "").endswith("99") for row in rows)

        finish_rule = next((row for row in rows if row.get("state_out") == "00000"), None)
        finish_msg = "感謝您的填寫！"
        if finish_rule:
            finish_msg = _extract_text_from_msg((finish_rule.get("msg_rpy") or [None])[0]) or finish_msg

        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT meta.group_id, grp.name AS group_name
            FROM "{tables["meta"]}" meta
            LEFT JOIN "{tables["groups"]}" grp ON grp.id = meta.group_id
            WHERE meta.note = %s
            ''',
            (note,),
        )
        meta_row = cur.fetchone()
        cur.close()

        return jsonify(
            {
                "note": note,
                "trigger": trigger,
                "start_time": start_time,
                "end_time": end_time,
                "enable_review": enable_review,
                "finish_msg": finish_msg,
                "questions": questions,
                "group_id": meta_row["group_id"] if meta_row else None,
                "group_name": meta_row["group_name"] if meta_row else None,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/responses/<note>", methods=["GET"], strict_slashes=False)
def get_questionnaire_responses(note):
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)

        rows = _load_questionnaire_rows(conn, app_id, note)
        if not rows:
            return jsonify({"error": "找不到該問卷"}), 404

        _, questions = _extract_questionnaire_questions(rows)
        escaped_note = _escape_like(note)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT pv.user_id, pv.name, pv.value, uname.value AS display_name
            FROM "{tables["private_var"]}" pv
            LEFT JOIN "{tables["private_var"]}" uname
                ON uname.user_id = pv.user_id AND uname.name = 'name'
            WHERE pv.name LIKE %s ESCAPE '\\'
            ORDER BY pv.user_id, pv.name
            ''',
            (f"ans_{escaped_note}_Q%",),
        )
        answer_rows = cur.fetchall()
        cur.close()

        responses_by_user = {}
        pattern = re.compile(rf"^ans_{re.escape(note)}_Q(\d+)$")
        for row in answer_rows:
            match = pattern.match(row["name"])
            if not match:
                continue
            question_number = int(match.group(1))
            if question_number <= 0:
                continue

            user_id = row["user_id"]
            if user_id not in responses_by_user:
                responses_by_user[user_id] = {
                    "user_id": user_id,
                    "display_name": row.get("display_name") or user_id,
                    "answers": {},
                }
            responses_by_user[user_id]["answers"][question_number] = row["value"]

        responses = []
        for user in responses_by_user.values():
            ordered_answers = []
            for index, question in enumerate(questions, start=1):
                ordered_answers.append(
                    {
                        "question_no": index,
                        "question": question["content"],
                        "answer": user["answers"].get(index, ""),
                    }
                )
            user["answers"] = ordered_answers
            user["answered_count"] = sum(1 for item in ordered_answers if item["answer"])
            responses.append(user)

        responses.sort(key=lambda item: (-item["answered_count"], item["display_name"]))

        return jsonify(
            {
                "note": note,
                "questions": [{"question_no": i + 1, "content": q["content"]} for i, q in enumerate(questions)],
                "responses": responses,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/build", methods=["POST"], strict_slashes=False)
def build_questionnaire():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    note = (data.get("note") or "").strip()
    trigger = (data.get("trigger") or "").strip()
    questions = data.get("questions", [])
    group_id = data.get("group_id")

    if not note:
        return jsonify({"error": "問卷名稱不能為空"}), 400
        
    if "工程用法則" not in note:
        note = f"{note} - 工程用法則"
        
    if not trigger:
        return jsonify({"error": "觸發指令不能為空"}), 400
    if not questions:
        return jsonify({"error": "至少需要一道題目"}), 400
    if not group_id:
        return jsonify({"error": "請先選擇問卷群組"}), 400

    for i, question in enumerate(questions, start=1):
        if str(question.get("cond", "1")) == "4":
            detail = question.get("cond_detail", "")
            parts = detail.split(",")
            if len(parts) != 2 or not all(part.strip().lstrip("-").isdigit() for part in parts):
                return jsonify({"error": f"第 {i} 題的字數限制格式錯誤，請使用最小,最大，例如 5,20"}), 400

    try:
        group_id = int(group_id)
    except Exception:
        return jsonify({"error": "群組格式不正確"}), 400

    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)

        cur = conn.cursor()
        cur.execute(f'SELECT 1 FROM "{tables["groups"]}" WHERE id = %s', (group_id,))
        if not cur.fetchone():
            cur.close()
            return jsonify({"error": "指定的問卷群組不存在"}), 400

        cur.execute(f'SELECT 1 FROM "{tables["q_bank"]}" WHERE note = %s LIMIT 1', (note,))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": f"問卷名稱「{note}」已存在，請使用不同名稱"}), 400

        quest_id = _get_next_available_id(conn, app_id)
        build_questionnaire_direct(data, app_id, conn, quest_id)
        _upsert_questionnaire_meta(conn, app_id, note, group_id)
        conn.commit()
        cur.close()
        _trigger_sql_reload()
        return jsonify({"status": "success", "message": f"問卷「{note}」已成功建立 (ID: {quest_id:02d})"})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@questionnaire_bp.route("/<note>", methods=["DELETE"], strict_slashes=False)
def delete_questionnaire(note):
    conn = None
    try:
        conn = get_db_connection()
        app_id = get_app_id()
        _ensure_questionnaire_tables(conn, app_id)
        tables = _table_names(app_id)
        cur = conn.cursor()
        cur.execute(f'DELETE FROM "{tables["q_bank"]}" WHERE note = %s', (note,))
        deleted = cur.rowcount
        cur.execute(f'DELETE FROM "{tables["meta"]}" WHERE note = %s', (note,))
        conn.commit()
        cur.close()
        _trigger_sql_reload()
        return jsonify({"status": "success", "deleted_rows": deleted})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

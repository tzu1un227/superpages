from datetime import datetime
import json
import re
import uuid

import requests
from flask import Blueprint, g, jsonify, request
from psycopg2.extras import RealDictCursor, Json

from db_utils import get_db_connection
from models import OAConfig


liff_questionnaire_bp = Blueprint("liff_questionnaire", __name__)


def _get_app_id():
    if hasattr(g, "current_app_name") and g.current_app_name:
        return str(g.current_app_name)
    if hasattr(g, "current_db_url") and g.current_db_url:
        path_part = g.current_db_url.split("/")[-1]
        return path_part.split("?")[0].strip()
    return "default"


def _set_oa_context_from_request():
    body = request.get_json(silent=True) or {}
    oa_id = request.headers.get("X-OA-ID") or request.args.get("oaId") or body.get("oaId")
    if not oa_id:
        oa_id = request.args.get("oa_id")
    if not oa_id:
        return
    oa = OAConfig.query.get(int(oa_id))
    if not oa or not oa.db_url:
        raise ValueError("OA setting not found")
    g.current_oa_config = oa
    g.current_db_url = oa.db_url
    g.current_oa_id = str(oa_id)
    app_name = (oa.other_settings or {}).get("app_name")
    if app_name:
        g.current_app_name = str(app_name)


def _tables(app_id):
    return {
        "questionnaires": f"liff_questionnaires:{app_id}",
        "questions": f"liff_questionnaire_questions:{app_id}",
        "responses": f"liff_questionnaire_responses:{app_id}",
        "answers": f"liff_questionnaire_answers:{app_id}",
        "private_var": f"Private_var:{app_id}",
    }


def _ensure_tables(conn, app_id):
    t = _tables(app_id)
    cur = conn.cursor()
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{t["questionnaires"]}" (
            id SERIAL PRIMARY KEY,
            survey_key TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'draft',
            default_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
            bot_app_name TEXT,
            start_time TIMESTAMP NULL,
            end_time TIMESTAMP NULL,
            allow_multiple BOOLEAN NOT NULL DEFAULT TRUE,
            finish_message TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{t["questions"]}" (
            id SERIAL PRIMARY KEY,
            questionnaire_id INTEGER NOT NULL,
            question_no INTEGER NOT NULL,
            content TEXT NOT NULL,
            answer_type TEXT NOT NULL DEFAULT 'text',
            required BOOLEAN NOT NULL DEFAULT TRUE,
            condition_type TEXT NOT NULL DEFAULT '1',
            condition_detail TEXT,
            options JSONB NOT NULL DEFAULT '[]'::jsonb,
            tags JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{t["responses"]}" (
            id SERIAL PRIMARY KEY,
            questionnaire_id INTEGER NOT NULL,
            line_user_id TEXT NOT NULL,
            display_name TEXT,
            picture_url TEXT,
            source_meta JSONB NOT NULL DEFAULT '{{}}'::jsonb,
            submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    cur.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{t["answers"]}" (
            id SERIAL PRIMARY KEY,
            response_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            question_no INTEGER NOT NULL,
            answer_value TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
        '''
    )
    
    # 遷移舊資料表：如果存在 liff_id 欄位則將其移除
    cur.execute(f'ALTER TABLE "{t["questionnaires"]}" DROP COLUMN IF EXISTS liff_id')

    # 建立平面化 VIEW 供方便的一鍵查詢作答結果
    view_name = f"v_liff_questionnaire_results:{app_id}"
    cur.execute(
        f'''
        CREATE OR REPLACE VIEW "{view_name}" AS
        SELECT 
            r.id AS response_id,
            r.line_user_id,
            r.display_name,
            r.submitted_at,
            q.survey_key,
            q.title AS survey_title,
            a.question_id,
            a.question_no,
            qu.content AS question_content,
            a.answer_value
        FROM "{t["responses"]}" r
        JOIN "{t["questionnaires"]}" q ON r.questionnaire_id = q.id
        LEFT JOIN "{t["answers"]}" a ON a.response_id = r.id
        LEFT JOIN "{t["questions"]}" qu ON a.question_id = qu.id
        '''
    )
    
    conn.commit()
    cur.close()


def _parse_time(value):
    if not value:
        return None
    clean = str(value).replace("Z", "").replace("T", " ").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            # 動態算出該 format 的實際字元長度（如 19, 16, 10）
            from datetime import datetime
            expected_len = len(datetime.now().strftime(fmt))
            if len(clean) >= expected_len:
                return datetime.strptime(clean[:expected_len], fmt)
        except ValueError:
            continue
    return None


def _json_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _serialize_question(row):
    return {
        "id": row["id"],
        "question_no": row["question_no"],
        "content": row["content"],
        "answer_type": row["answer_type"],
        "required": row["required"],
        "condition_type": row["condition_type"],
        "condition_detail": row["condition_detail"] or "",
        "options": row["options"] or [],
        "tags": row["tags"] or [],
    }


def _load_survey(conn, app_id, survey_key):
    t = _tables(app_id)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f'SELECT * FROM "{t["questionnaires"]}" WHERE survey_key = %s', (survey_key,))
    survey = cur.fetchone()
    if not survey:
        cur.close()
        return None, []
    cur.execute(
        f'SELECT * FROM "{t["questions"]}" WHERE questionnaire_id = %s ORDER BY question_no, id',
        (survey["id"],),
    )
    questions = cur.fetchall()
    cur.close()
    return survey, questions


def _validate_answer(question, value):
    required = bool(question["required"])
    answer_type = question["answer_type"]
    condition_type = str(question["condition_type"] or "1")
    detail = question["condition_detail"] or ""
    options = question["options"] or []

    if isinstance(value, list):
        normalized = [str(item).strip() for item in value if str(item).strip()]
        text = ",".join(normalized)
    else:
        normalized = None
        text = "" if value is None else str(value).strip()

    if required and not text:
        return False, "此題為必填"
    if not text:
        return True, ""

    if answer_type == "number" or condition_type == "2":
        if not re.fullmatch(r"-?\d+(\.\d+)?", text):
            return False, "請輸入數字"
    if answer_type == "single_choice" or (condition_type == "3" and answer_type != "multiple_choice"):
        allowed = options or _json_list(detail)
        if text not in allowed:
            return False, "請選擇有效選項"
    if answer_type == "multiple_choice":
        allowed = options or _json_list(detail)
        if normalized is None:
            normalized = _json_list(text)
        invalid = [item for item in normalized if item not in allowed]
        if invalid:
            return False, "包含無效選項"
        text = ",".join(normalized)
    if condition_type == "4":
        parts = detail.split(",")
        try:
            min_len = int(parts[0]) if len(parts) > 0 and parts[0].strip() else 0
            max_len = int(parts[1]) if len(parts) > 1 and parts[1].strip() else -1
        except ValueError:
            min_len, max_len = 0, -1
        if len(text) < min_len:
            return False, f"至少需要 {min_len} 個字"
        if max_len >= 0 and len(text) > max_len:
            return False, f"最多只能 {max_len} 個字"
    if answer_type == "phone" or condition_type == "5":
        if not re.fullmatch(r"09\d{8}", text):
            return False, "請輸入 09 開頭的 10 碼手機"
    if answer_type == "email" or condition_type == "6":
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", text):
            return False, "Email 格式不正確"
    if answer_type == "date" or condition_type == "7":
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return False, "日期格式需為 YYYY-MM-DD"
    return True, text


def _verify_line_identity(data):
    id_token = data.get("id_token")
    profile = data.get("profile") or {}
    settings = getattr(g, "current_oa_config", None).other_settings if getattr(g, "current_oa_config", None) else {}
    channel_id = settings.get("liff_channel_id") or settings.get("line_login_channel_id")

    if id_token and channel_id:
        resp = requests.post(
            "https://api.line.me/oauth2/v2.1/verify",
            data={"id_token": id_token, "client_id": channel_id},
            timeout=8,
        )
        if resp.status_code != 200:
            raise ValueError("LINE identity verification failed")
        payload = resp.json()
        return {
            "line_user_id": payload.get("sub"),
            "display_name": payload.get("name") or profile.get("displayName") or "",
            "picture_url": payload.get("picture") or profile.get("pictureUrl") or "",
            "trusted": True,
        }

    user_id = profile.get("userId") or data.get("line_user_id")
    if not user_id:
        raise ValueError("Missing LINE user identity")
    return {
        "line_user_id": user_id,
        "display_name": profile.get("displayName") or data.get("display_name") or "",
        "picture_url": profile.get("pictureUrl") or "",
        "trusted": False,
    }


def _merge_user_tags(conn, app_id, user_id, tags):
    tags = [tag for tag in dict.fromkeys(_json_list(tags)) if tag]
    if not tags:
        return
    table = _tables(app_id)["private_var"]
    cur = conn.cursor()
    cur.execute(f'SELECT value FROM "{table}" WHERE user_id = %s AND name = %s', (user_id, "tag"))
    row = cur.fetchone()
    existing = []
    if row and row[0]:
        try:
            parsed = json.loads(row[0].replace("'", '"'))
            existing = parsed if isinstance(parsed, list) else [str(parsed)]
        except Exception:
            existing = [item.strip() for item in str(row[0]).strip("[]").replace("'", "").split(",") if item.strip()]
    merged = list(dict.fromkeys(existing + tags))
    cur.execute(f'DELETE FROM "{table}" WHERE user_id = %s AND name = %s', (user_id, "tag"))
    cur.execute(f'INSERT INTO "{table}" (user_id, name, value) VALUES (%s, %s, %s)', (user_id, "tag", str(merged)))
    cur.close()


def _survey_payload(survey, questions):
    return {
        "id": survey["id"],
        "survey_key": survey["survey_key"],
        "title": survey["title"],
        "description": survey["description"] or "",
        "status": survey["status"],
        "default_tags": survey["default_tags"] or [],
        "bot_app_name": survey["bot_app_name"] or "",
        "liff_id": "",
        "start_time": survey["start_time"].isoformat(timespec="minutes") if survey["start_time"] else "",
        "end_time": survey["end_time"].isoformat(timespec="minutes") if survey["end_time"] else "",
        "allow_multiple": survey["allow_multiple"],
        "finish_message": survey["finish_message"] or "感謝你的填寫",
        "questions": [_serialize_question(q) for q in questions],
    }


def _question_tags_from_rows(questions):
    tags = []
    for question in questions or []:
        tags.extend(question.get("tags") or [])
    return list(dict.fromkeys(str(tag).strip() for tag in tags if str(tag).strip()))


def _survey_list_payload(row):
    payload = _survey_payload(row, [])
    payload["response_count"] = row.get("response_count", 0)
    payload["question_count"] = row.get("question_count", 0)
    payload["question_tags"] = row.get("question_tags") or []
    payload["created_at"] = row["created_at"].isoformat(timespec="seconds") if row.get("created_at") else ""
    payload["updated_at"] = row["updated_at"].isoformat(timespec="seconds") if row.get("updated_at") else ""
    return payload


@liff_questionnaire_bp.route("/", methods=["GET"], strict_slashes=False)
def list_surveys():
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT q.*,
                   COUNT(DISTINCT r.id) AS response_count,
                   COUNT(DISTINCT qu.id) AS question_count,
                   COALESCE(
                       (
                           SELECT jsonb_agg(DISTINCT tag)
                           FROM (
                               SELECT jsonb_array_elements_text(qu2.tags) AS tag
                               FROM "{t["questions"]}" qu2
                               WHERE qu2.questionnaire_id = q.id
                           ) tag_rows
                           WHERE tag IS NOT NULL AND tag <> ''
                       ),
                       '[]'::jsonb
                   ) AS question_tags
            FROM "{t["questionnaires"]}" q
            LEFT JOIN "{t["responses"]}" r ON r.questionnaire_id = q.id
            LEFT JOIN "{t["questions"]}" qu ON qu.questionnaire_id = q.id
            GROUP BY q.id
            ORDER BY q.updated_at DESC, q.id DESC
            '''
        )
        surveys = cur.fetchall()
        cur.close()
        return jsonify({"surveys": [_survey_list_payload(row) for row in surveys]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/", methods=["POST"], strict_slashes=False)
def create_survey():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    questions = data.get("questions") or []
    if not title:
        return jsonify({"error": "問卷名稱必填"}), 400
    if not questions:
        return jsonify({"error": "至少需要一題"}), 400

    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        survey_key = data.get("survey_key") or uuid.uuid4().hex[:10]
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            INSERT INTO "{t["questionnaires"]}"
                (survey_key, title, description, status, default_tags, bot_app_name,
                 start_time, end_time, allow_multiple, finish_message, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            RETURNING *
            ''',
            (
                survey_key,
                title,
                data.get("description") or "",
                data.get("status") or "published",
                Json(_json_list(data.get("default_tags"))),
                data.get("bot_app_name") or app_id,
                _parse_time(data.get("start_time")),
                _parse_time(data.get("end_time")),
                bool(data.get("allow_multiple", True)),
                data.get("finish_message") or "感謝你的填寫",
            ),
        )
        survey = cur.fetchone()
        for index, question in enumerate(questions, start=1):
            cur.execute(
                f'''
                INSERT INTO "{t["questions"]}"
                    (questionnaire_id, question_no, content, answer_type, required,
                     condition_type, condition_detail, options, tags)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''',
                (
                    survey["id"],
                    index,
                    question.get("content") or "",
                    question.get("answer_type") or "text",
                    bool(question.get("required", True)),
                    str(question.get("condition_type") or "1"),
                    question.get("condition_detail") or "",
                    Json(_json_list(question.get("options"))),
                    Json(_json_list(question.get("tags"))),
                ),
            )
        conn.commit()
        _, saved_questions = _load_survey(conn, app_id, survey_key)
        cur.close()
        survey_payload = _survey_payload(survey, saved_questions)
        survey_payload["question_tags"] = _question_tags_from_rows(saved_questions)
        return jsonify({"status": "success", "survey": survey_payload})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/<survey_key>", methods=["GET"], strict_slashes=False)
def get_survey(survey_key):
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        survey, questions = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
        return jsonify({"survey": _survey_payload(survey, questions)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/<survey_key>", methods=["DELETE"], strict_slashes=False)
def delete_survey(survey_key):
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        survey, _ = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
        cur = conn.cursor()
        cur.execute(f'DELETE FROM "{t["answers"]}" WHERE response_id IN (SELECT id FROM "{t["responses"]}" WHERE questionnaire_id = %s)', (survey["id"],))
        cur.execute(f'DELETE FROM "{t["responses"]}" WHERE questionnaire_id = %s', (survey["id"],))
        cur.execute(f'DELETE FROM "{t["questions"]}" WHERE questionnaire_id = %s', (survey["id"],))
        cur.execute(f'DELETE FROM "{t["questionnaires"]}" WHERE id = %s', (survey["id"],))
        conn.commit()
        cur.close()
        return jsonify({"status": "success"})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/<survey_key>", methods=["PUT"], strict_slashes=False)
def update_survey(survey_key):
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    questions = data.get("questions") or []
    if not title:
        return jsonify({"error": "問卷名稱必填"}), 400
    if not questions:
        return jsonify({"error": "至少需要一題"}), 400

    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        
        survey, existing_questions = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
            
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            f'''
            UPDATE "{t["questionnaires"]}"
            SET title = %s,
                description = %s,
                status = %s,
                default_tags = %s,
                start_time = %s,
                end_time = %s,
                allow_multiple = %s,
                finish_message = %s,
                updated_at = NOW()
            WHERE id = %s
            RETURNING *
            ''',
            (
                title,
                data.get("description") or "",
                data.get("status") or "published",
                Json(_json_list(data.get("default_tags"))),
                _parse_time(data.get("start_time")),
                _parse_time(data.get("end_time")),
                bool(data.get("allow_multiple", True)),
                data.get("finish_message") or "感謝你的填寫",
                survey["id"]
            )
        )
        updated_survey = cur.fetchone()
        
        existing_q_map = {q["id"]: q for q in existing_questions}
        keep_ids = []
        
        for index, question in enumerate(questions, start=1):
            q_id = question.get("id")
            if q_id and int(q_id) in existing_q_map:
                q_id = int(q_id)
                keep_ids.append(q_id)
                cur.execute(
                    f'''
                    UPDATE "{t["questions"]}"
                    SET question_no = %s,
                        content = %s,
                        answer_type = %s,
                        required = %s,
                        condition_type = %s,
                        condition_detail = %s,
                        options = %s,
                        tags = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    ''',
                    (
                        index,
                        question.get("content") or "",
                        question.get("answer_type") or "text",
                        bool(question.get("required", True)),
                        str(question.get("condition_type") or "1"),
                        question.get("condition_detail") or "",
                        Json(_json_list(question.get("options"))),
                        Json(_json_list(question.get("tags"))),
                        q_id
                    )
                )
            else:
                cur.execute(
                    f'''
                    INSERT INTO "{t["questions"]}"
                        (questionnaire_id, question_no, content, answer_type, required,
                         condition_type, condition_detail, options, tags)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    ''',
                    (
                        survey["id"],
                        index,
                        question.get("content") or "",
                        question.get("answer_type") or "text",
                        bool(question.get("required", True)),
                        str(question.get("condition_type") or "1"),
                        question.get("condition_detail") or "",
                        Json(_json_list(question.get("options"))),
                        Json(_json_list(question.get("tags"))),
                    )
                )
                new_q = cur.fetchone()
                keep_ids.append(new_q["id"])
                
        to_delete = [qid for qid in existing_q_map.keys() if qid not in keep_ids]
        if to_delete:
            cur.execute(
                f'DELETE FROM "{t["questions"]}" WHERE questionnaire_id = %s AND id = ANY(%s)',
                (survey["id"], to_delete)
            )
            
        conn.commit()
        _, saved_questions = _load_survey(conn, app_id, survey_key)
        cur.close()
        
        survey_payload = _survey_payload(updated_survey, saved_questions)
        survey_payload["question_tags"] = _question_tags_from_rows(saved_questions)
        return jsonify({"status": "success", "survey": survey_payload})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/<survey_key>/responses", methods=["GET"], strict_slashes=False)
def get_responses(survey_key):
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        survey, questions = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'''
            SELECT r.id AS response_id, r.line_user_id, r.display_name, r.picture_url,
                   r.source_meta, r.submitted_at,
                   a.question_id, a.question_no, a.answer_value
            FROM "{t["responses"]}" r
            LEFT JOIN "{t["answers"]}" a ON a.response_id = r.id
            WHERE r.questionnaire_id = %s
            ORDER BY r.submitted_at DESC, r.id DESC, a.question_no
            ''',
            (survey["id"],),
        )
        rows = cur.fetchall()
        cur.close()
        by_response = {}
        question_map = {q["id"]: q for q in questions}
        for row in rows:
            rid = row["response_id"]
            if rid not in by_response:
                by_response[rid] = {
                    "response_id": rid,
                    "line_user_id": row["line_user_id"],
                    "display_name": row["display_name"] or row["line_user_id"],
                    "picture_url": row["picture_url"],
                    "source_meta": row["source_meta"] or {},
                    "submitted_at": row["submitted_at"].isoformat(timespec="seconds"),
                    "answers": [],
                }
            if row["question_id"]:
                question = question_map.get(row["question_id"], {})
                by_response[rid]["answers"].append(
                    {
                        "question_id": row["question_id"],
                        "question_no": row["question_no"],
                        "question": question.get("content", ""),
                        "answer": row["answer_value"] or "",
                    }
                )
        return jsonify({
            "survey": _survey_payload(survey, questions),
            "responses": list(by_response.values()),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/public/<survey_key>", methods=["GET"], strict_slashes=False)
def public_get_survey(survey_key):
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        survey, questions = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
        if survey["status"] != "published":
            return jsonify({"error": "問卷尚未開放"}), 403
        
        from datetime import datetime, timedelta
        # 台灣時區 (UTC+8)
        now_tw = datetime.utcnow() + timedelta(hours=8)
        
        if survey["start_time"] and now_tw < survey["start_time"]:
            return jsonify({"error": "問卷尚未開始"}), 403
        if survey["end_time"] and now_tw > survey["end_time"]:
            return jsonify({"error": "問卷已結束"}), 403
        return jsonify({"survey": _survey_payload(survey, questions)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


@liff_questionnaire_bp.route("/public/<survey_key>/responses", methods=["POST"], strict_slashes=False)
def public_submit_response(survey_key):
    data = request.get_json() or {}
    conn = None
    try:
        _set_oa_context_from_request()
        conn = get_db_connection()
        app_id = _get_app_id()
        _ensure_tables(conn, app_id)
        t = _tables(app_id)
        survey, questions = _load_survey(conn, app_id, survey_key)
        if not survey:
            return jsonify({"error": "問卷不存在"}), 404
        if survey["status"] != "published":
            return jsonify({"error": "問卷尚未開放"}), 403

        from datetime import datetime, timedelta
        now_tw = datetime.utcnow() + timedelta(hours=8)
        if survey["start_time"] and now_tw < survey["start_time"]:
            return jsonify({"error": "問卷尚未開始"}), 403
        if survey["end_time"] and now_tw > survey["end_time"]:
            return jsonify({"error": "問卷已結束"}), 403

        identity = _verify_line_identity(data)
        answers = data.get("answers") or {}
        if isinstance(answers, list):
            answers = {str(item.get("question_id") or item.get("question_no")): item.get("value") for item in answers}

        cur = conn.cursor(cursor_factory=RealDictCursor)
        if not survey["allow_multiple"]:
            cur.execute(
                f'SELECT 1 FROM "{t["responses"]}" WHERE questionnaire_id = %s AND line_user_id = %s LIMIT 1',
                (survey["id"], identity["line_user_id"]),
            )
            if cur.fetchone():
                cur.close()
                return jsonify({"error": "你已經填寫過此問卷"}), 409

        collected_tags = []
        validated = []
        errors = {}
        for question in questions:
            key_id = str(question["id"])
            key_no = str(question["question_no"])
            value = answers.get(key_id, answers.get(key_no, ""))
            ok, result = _validate_answer(question, value)
            if not ok:
                errors[key_id] = result
            else:
                validated.append((question, result))
                if result:
                    collected_tags.extend(question["tags"] or [])
        if errors:
            cur.close()
            return jsonify({"error": "答案格式不正確", "fields": errors}), 400

        query_tags = _json_list(request.args.get("defaultTags"))
        body_tags = _json_list(data.get("default_tags"))
        stored_tags = survey["default_tags"] or []
        collected_tags = list(dict.fromkeys(stored_tags + query_tags + body_tags + collected_tags))

        source_meta = {
            "bot_app_name": request.args.get("botAppName") or data.get("bot_app_name") or survey["bot_app_name"],
            "url_app_name": request.args.get("appName") or data.get("app_name"),
            "default_tags": collected_tags,
            "identity_trusted": identity["trusted"],
        }
        cur.execute(
            f'''
            INSERT INTO "{t["responses"]}"
                (questionnaire_id, line_user_id, display_name, picture_url, source_meta)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, submitted_at
            ''',
            (
                survey["id"],
                identity["line_user_id"],
                identity["display_name"],
                identity["picture_url"],
                Json(source_meta),
            ),
        )
        response = cur.fetchone()
        for question, value in validated:
            cur.execute(
                f'''
                INSERT INTO "{t["answers"]}" (response_id, question_id, question_no, answer_value)
                VALUES (%s, %s, %s, %s)
                ''',
                (response["id"], question["id"], question["question_no"], value),
            )
        _merge_user_tags(conn, app_id, identity["line_user_id"], collected_tags)
        conn.commit()
        cur.close()
        return jsonify({
            "status": "success",
            "response_id": response["id"],
            "finish_message": survey["finish_message"] or "感謝你的填寫",
        })
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

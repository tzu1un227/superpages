import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

SUPERPAGES_DB_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

STD_SUFFIX = "yzulabuse"
TARGET_SUFFIX = "5013"

def sync_schema():
    print("=== [開始同步與修復 5013 資料庫 Schema] ===")
    
    conn_std = psycopg2.connect(SUPERPAGES_DB_URL)
    cur_std = conn_std.cursor(cursor_factory=RealDictCursor)

    conn_tgt = psycopg2.connect(TARGET_5013_DB_URL)
    cur_tgt = conn_tgt.cursor(cursor_factory=RealDictCursor)

    # 1. 補齊 5013 缺少的關鍵欄位
    print("\n--- [步驟 1: 補齊 5013 核心表格缺少的欄位] ---")
    columns_to_add = [
        ('QA_bank:5013', 'IO', 'text'),
        ('project_schedules:5013', 'interval_hours', 'integer DEFAULT 0'),
        ('project_schedules:5013', 'message_content', 'text'),
        ('projects:5013', 'type', 'character varying(255) DEFAULT \'normal\''),
        ('question_table:5013', 'ques_number', 'character varying(255)'),
        ('question_table:5013', 'keyword', 'character varying(255)'),
        ('rich_menu_metadata:5013', 'group_id', 'character varying(255)'),
        ('rich_menu_metadata:5013', 'ui_uuid', 'character varying(255)'),
    ]

    for table_name, col_name, col_type in columns_to_add:
        # Check if table exists
        cur_tgt.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (table_name,))
        if cur_tgt.fetchone():
            # Check if column exists
            cur_tgt.execute("SELECT 1 FROM information_schema.columns WHERE table_name = %s AND column_name = %s", (table_name, col_name))
            if not cur_tgt.fetchone():
                alter_sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col_name}" {col_type};'
                cur_tgt.execute(alter_sql)
                print(f"  ✅ 成功為 \"{table_name}\" 新增欄位 \"{col_name}\" ({col_type})")
            else:
                print(f"  ℹ️  \"{table_name}\" 已存在欄位 \"{col_name}\"")
        else:
            print(f"  ⚠️  表格 \"{table_name}\" 不存在，跳過新增欄位")

    conn_tgt.commit()

    # 2. 補齊缺少的 LIFF 問卷與 AD_bank 表格結構
    print("\n--- [步驟 2: 補齊 5013 缺少的 Superpages / LIFF 問卷表格與 View] ---")
    tables_to_ensure = [
        f"AD_bank:{TARGET_SUFFIX}",
        f"liff_questionnaires:{TARGET_SUFFIX}",
        f"liff_questionnaire_questions:{TARGET_SUFFIX}",
        f"liff_questionnaire_responses:{TARGET_SUFFIX}",
        f"liff_questionnaire_answers:{TARGET_SUFFIX}"
    ]

    for tbl in tables_to_ensure:
        cur_tgt.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (tbl,))
        if not cur_tgt.fetchone():
            std_tbl_name = tbl.replace(f":{TARGET_SUFFIX}", f":{STD_SUFFIX}")
            # Get CREATE TABLE definition or columns from std DB
            cur_std.execute("""
                SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position
            """, (std_tbl_name,))
            cols = cur_std.fetchall()
            
            if cols:
                col_defs = []
                for c in cols:
                    c_name = f"\"{c['column_name']}\""
                    c_type = c['data_type']
                    if c['character_maximum_length']:
                        c_type += f"({c['character_maximum_length']})"
                    c_null = "" if c['is_nullable'] == 'YES' else "NOT NULL"
                    c_def = f"DEFAULT {c['column_default']}" if c['column_default'] else ""
                    col_defs.append(f"{c_name} {c_type} {c_null} {c_def}".strip())
                
                create_sql = f'CREATE TABLE "{tbl}" ({", ".join(col_defs)});'
                cur_tgt.execute(create_sql)
                print(f"  ✅ 成功建立表格 \"{tbl}\"")
            else:
                print(f"  ⚠️  無法取得標竿表格 \"{std_tbl_name}\" 之欄位定義")
        else:
            print(f"  ℹ️  表格 \"{tbl}\" 已存在")

    conn_tgt.commit()

    # 建立 v_liff_questionnaire_results:5013 View
    view_name = f"v_liff_questionnaire_results:{TARGET_SUFFIX}"
    cur_tgt.execute("SELECT 1 FROM information_schema.views WHERE table_name = %s", (view_name,))
    if not cur_tgt.fetchone():
        create_view_sql = f'''
            CREATE OR REPLACE VIEW "{view_name}" AS
            SELECT 
                r.id AS response_id,
                r.survey_key,
                q.title AS survey_title,
                r.line_user_id,
                r.display_name,
                r.picture_url,
                r.submitted_at,
                a.question_id,
                qu.content AS question_content,
                qu.answer_type,
                a.answer_value
            FROM "{f"liff_questionnaire_responses:{TARGET_SUFFIX}"}" r
            JOIN "{f"liff_questionnaires:{TARGET_SUFFIX}"}" q ON r.survey_key = q.survey_key
            LEFT JOIN "{f"liff_questionnaire_answers:{TARGET_SUFFIX}"}" a ON r.id = a.response_id
            LEFT JOIN "{f"liff_questionnaire_questions:{TARGET_SUFFIX}"}" qu ON a.question_id = qu.id;
        '''
        try:
            cur_tgt.execute(create_view_sql)
            conn_tgt.commit()
            print(f"  ✅ 成功建立 View \"{view_name}\"")
        except Exception as e:
            print(f"  ⚠️  建立 View \"{view_name}\" 失敗: {e}")
            conn_tgt.rollback()
    else:
        print(f"  ℹ️  View \"{view_name}\" 已存在")

    # 3. 移除多餘且廢棄的測試表格與 bot1 殘留表
    print("\n--- [步驟 3: 移除 5013 中多餘與廢棄的表格] ---")
    extra_tables_to_remove = [
        "awardpoolA", "employee_list", "person_tableA", "person_tableB", "test", "ticket_table",
        "AD_bank:bot1", "Global_var:bot1", "Private_var:bot1", "QA_bank:bot1", "Q_bank:bot1", "history:bot1"
    ]

    for tbl in extra_tables_to_remove:
        cur_tgt.execute("SELECT table_type FROM information_schema.tables WHERE table_name = %s", (tbl,))
        res = cur_tgt.fetchone()
        if res:
            t_type = res['table_type']
            drop_cmd = "DROP VIEW" if t_type == 'VIEW' else "DROP TABLE"
            cur_tgt.execute(f'{drop_cmd} "{tbl}" CASCADE;')
            print(f"  🗑️  成功移除多餘的 {t_type} \"{tbl}\"")
        else:
            print(f"  ℹ️  多餘表格 \"{tbl}\" 已不在資料庫中")

    conn_tgt.commit()

    cur_std.close()
    conn_std.close()
    cur_tgt.close()
    conn_tgt.close()

    print("\n=== [5013 資料庫 Schema 同步與修復完成] ===")

if __name__ == '__main__':
    sync_schema()

import psycopg2
from psycopg2.extras import RealDictCursor
import sys

OLD_RDS_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
NEW_RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"

def migrate():
    print("Connecting to Old RDS and New Primary DB...")
    conn_src = psycopg2.connect(OLD_RDS_URL)
    cur_src = conn_src.cursor(cursor_factory=RealDictCursor)

    conn_dst = psycopg2.connect(NEW_RDS_URL)
    cur_dst = conn_dst.cursor()

    # 1. 取得所有與 superpages 相關的主表格與多租戶表格
    cur_src.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema='public' 
        AND (
            table_name IN ('users', 'pages', 'permission_settings')
            OR table_name LIKE 'broadcasts:%%'
            OR table_name LIKE 'cron_table:%%'
            OR table_name LIKE 'project_schedules:%%'
            OR table_name LIKE 'rich_menu_metadata:%%'
        )
    """)
    tables = [row['table_name'] for row in cur_src.fetchall()]
    print(f"Found {len(tables)} tables to migrate: {tables}")

    for tbl in tables:
        print(f"\nProcessing table: {tbl}...")
        # 取得欄位資訊
        cur_src.execute(f"""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, (tbl,))
        columns_info = cur_src.fetchall()
        col_names = [c['column_name'] for c in columns_info]

        # 讀取舊資料
        cur_src.execute(f'SELECT * FROM "{tbl}"')
        rows = cur_src.fetchall()
        print(f"Table '{tbl}' has {len(rows)} records.")

        # 如果目標資料庫尚無該表，透過 DDL 自動建構
        # (針對 users, pages, permission_settings，先前 init_main_db 已建結構，其餘動態表直接建)
        quoted_tbl = f'"{tbl}"'
        cur_dst.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (tbl,))
        if not cur_dst.fetchone():
            # 建表 DDL 簡單生成
            col_defs = []
            for c in columns_info:
                col_name = c['column_name']
                dtype = c['data_type']
                if dtype == 'ARRAY':
                    dtype = 'TEXT[]'
                elif dtype == 'USER-DEFINED':
                    dtype = 'JSONB'
                
                # 特殊邏輯 handle SERIAL / PRIMARY KEY
                if col_name in ('id', 'schedule_id', 'task_id') and c['column_default'] and 'nextval' in c['column_default']:
                    col_defs.append(f'"{col_name}" SERIAL PRIMARY KEY')
                else:
                    nullable = "" if c['is_nullable'] == 'YES' else " NOT NULL"
                    default = f" DEFAULT {c['column_default']}" if c['column_default'] else ""
                    col_defs.append(f'"{col_name}" {dtype}{default}')

            create_sql = f'CREATE TABLE IF NOT EXISTS {quoted_tbl} (\n  ' + ',\n  '.join(col_defs) + '\n);'
            cur_dst.execute(create_sql)
            conn_dst.commit()

        # 清空目標表舊紀錄（防重複），隨後匯入舊 RDS 紀錄
        cur_dst.execute(f'TRUNCATE TABLE {quoted_tbl} RESTART IDENTITY CASCADE;')
        
        if rows:
            cols_str = ', '.join([f'"{c}"' for c in col_names])
            val_placeholders = ', '.join(['%s'] * len(col_names))
            insert_sql = f'INSERT INTO {quoted_tbl} ({cols_str}) VALUES ({val_placeholders})'

            from psycopg2.extras import Json
            data_tuples = []
            for r in rows:
                tup = tuple(Json(r[c]) if isinstance(r[c], (dict, list)) else r[c] for c in col_names)
                data_tuples.append(tup)

            cur_dst.executemany(insert_sql, data_tuples)
            conn_dst.commit()

            # 重置 Sequence ID（如果有 SERIAL 主鍵）
            pk_col = 'id'
            if 'task_id' in col_names: pk_col = 'task_id'
            elif 'schedule_id' in col_names: pk_col = 'schedule_id'

            if pk_col in col_names:
                try:
                    cur_dst.execute(f"SELECT setval(pg_get_serial_sequence('{quoted_tbl}', '{pk_col}'), coalesce(max(\"{pk_col}\"), 1)) FROM {quoted_tbl};")
                    conn_dst.commit()
                except Exception as seq_err:
                    conn_dst.rollback()
                    print(f"Notice resetting sequence for {tbl}: {seq_err}")

        print(f"Table '{tbl}' migrated successfully!")

    cur_src.close()
    conn_src.close()
    cur_dst.close()
    conn_dst.close()
    print("\nAll database migration completed successfully!")

if __name__ == '__main__':
    migrate()

import sys
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Add backend directory to sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app import app
from models import OAConfig
from db_utils import get_db_connection

def migrate_cron_table():
    with app.app_context():
        oas = OAConfig.query.all()
        print(f"=== 開始檢查與遷移所有 OA 的 cron_table 資料 (共 {len(oas)} 個 OA) ===")
        
        for oa in oas:
            app_name = oa.other_settings.get('app_name') if oa.other_settings else str(oa.id)
            if not app_name:
                app_name = str(oa.id)
                
            db_url = oa.db_url
            if not db_url:
                print(f"[{oa.id} - {oa.oa_name}] 跳過 (無 db_url)")
                continue

            conn = None
            try:
                conn = get_db_connection(db_url)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                t_cron = f'"cron_table:{app_name}"'
                
                # Check if table exists
                cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (f"cron_table:{app_name}",))
                if not cur.fetchone():
                    print(f"[{oa.id} - {oa.oa_name}] 表格 {t_cron} 不存在，跳過。")
                    continue
                
                # Select active rows that still have QA| format
                cur.execute(f"SELECT task_id, user_id, message_content FROM {t_cron} WHERE message_content LIKE 'QA|%%'")
                rows = cur.fetchall()
                
                if not rows:
                    print(f"[{oa.id} - {oa.oa_name}] {t_cron} 中無舊版 QA| 格式任務。")
                    continue
                
                print(f"[{oa.id} - {oa.oa_name}] 找到 {len(rows)} 筆舊版 QA| 格式任務，準備遷移...")
                
                updated_count = 0
                for row in rows:
                    task_id = row['task_id']
                    mc = str(row['message_content'])
                    tag = mc.split('|')[-1]
                    new_mc = f"get_out(qa('{tag}'))"
                    
                    cur.execute(f"UPDATE {t_cron} SET message_content = %s WHERE task_id = %s", (new_mc, task_id))
                    updated_count += 1
                
                conn.commit()
                print(f"[{oa.id} - {oa.oa_name}] 成功遷移 {updated_count} 筆任務為函式格式！")
                
            except Exception as e:
                if conn: conn.rollback()
                print(f"[{oa.id} - {oa.oa_name}] 遷移失敗: {e}")
            finally:
                if conn: conn.close()

        print("=== cron_table 遷移作業完成 ===")

if __name__ == '__main__':
    migrate_cron_table()

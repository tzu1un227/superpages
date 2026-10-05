import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"
SUPERPAGES_DB_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"

def fix_column_types(db_url, db_name):
    print(f"=== 修正 {db_name} 資料庫 project_schedules 欄位型態 ===")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE 'project_schedules%'
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    
    for t in tables:
        try:
            sql = f'ALTER TABLE "{t}" ALTER COLUMN interval_hours TYPE double precision USING interval_hours::double precision;'
            cur.execute(sql)
            print(f"  ✅ 成功將 \"{t}\".interval_hours 型態修改為 double precision")
        except Exception as e:
            print(f"  ⚠️ 修改 \"{t}\" 失敗: {e}")
            conn.rollback()
            
    conn.commit()
    cur.close()
    conn.close()

if __name__ == '__main__':
    fix_column_types(TARGET_5013_DB_URL, "5013")
    fix_column_types(SUPERPAGES_DB_URL, "Superpages/Heroku")

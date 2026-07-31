import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"
SUPERPAGES_DB_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"

def drop_not_null_constraints(db_url, db_name):
    print(f"=== 修正 {db_name} project_schedules action_type 欄位 constraints ===")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE 'project_schedules%'
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    
    for t in tables:
        for col in ['action_type', 'action_data', 'delay_minutes']:
            try:
                sql = f'ALTER TABLE "{t}" ALTER COLUMN "{col}" DROP NOT NULL;'
                cur.execute(sql)
                print(f"  ✅ 成功移除 \"{t}\".\"{col}\" 之 NOT NULL 約束")
            except Exception as e:
                conn.rollback()
                
    conn.commit()
    cur.close()
    conn.close()

if __name__ == '__main__':
    drop_not_null_constraints(TARGET_5013_DB_URL, "5013")
    drop_not_null_constraints(SUPERPAGES_DB_URL, "Superpages/Heroku")

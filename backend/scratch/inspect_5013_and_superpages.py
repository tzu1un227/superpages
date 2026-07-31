import os
import psycopg2
from psycopg2.extras import RealDictCursor

MAIN_DB_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

def inspect_oas():
    conn = psycopg2.connect(MAIN_DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings ORDER BY id ASC")
    rows = cur.fetchall()
    
    print("=== 主資料庫 permission_settings 列表 ===")
    for r in rows:
        print(f"ID: {r['id']} | Name: {r['oa_name']} | DB: {r['db_url']} | Other: {r['other_settings']}")
        
    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect_oas()

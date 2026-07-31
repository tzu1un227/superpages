import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

MAIN_DB_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

def list_all_oas():
    conn = psycopg2.connect(MAIN_DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings ORDER BY id ASC")
    rows = cur.fetchall()
    print("=== permission_settings 中的所有帳號 ===")
    for r in rows:
        print(f"ID: {r['id']} | Name: '{r['oa_name']}' | Other: {r['other_settings']}")
    cur.close()
    conn.close()

if __name__ == '__main__':
    list_all_oas()

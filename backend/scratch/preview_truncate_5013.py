import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def preview_truncate():
    conn = psycopg2.connect(TARGET_5013_DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Fetch all BASE TABLEs in 5013 DB
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    
    preserve_tables = []
    truncate_tables = []
    
    for t in tables:
        # Check if it's AD_bank or Q_bank
        if 'AD_bank' in t or 'Q_bank' in t:
            preserve_tables.append(t)
        else:
            truncate_tables.append(t)
            
    print("=== [5013 資料庫表格清空預覽] ===")
    print(f"📌 將【保留內容】的表格 ({len(preserve_tables)} 個):")
    for t in preserve_tables:
        cur.execute(f'SELECT COUNT(*) as cnt FROM "{t}"')
        cnt = cur.fetchone()['cnt']
        print(f"  - {t} (當前資料筆數: {cnt})")
        
    print(f"\n🗑️ 將【清空內容】的表格 ({len(truncate_tables)} 個):")
    for t in truncate_tables:
        try:
            cur.execute(f'SELECT COUNT(*) as cnt FROM "{t}"')
            cnt = cur.fetchone()['cnt']
            print(f"  - {t} (當前資料筆數: {cnt})")
        except Exception as e:
            print(f"  - {t} (無法取得筆數: {e})")
            conn.rollback()

    cur.close()
    conn.close()
    return preserve_tables, truncate_tables

if __name__ == '__main__':
    preview_truncate()

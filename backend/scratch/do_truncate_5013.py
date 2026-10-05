import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def execute_truncate():
    conn = psycopg2.connect(TARGET_5013_DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch BASE TABLEs
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    
    truncate_tables = [t for t in tables if 'AD_bank' not in t and 'Q_bank' not in t]
    preserve_tables = [t for t in tables if 'AD_bank' in t or 'Q_bank' in t]

    print("=== [執行 5013 資料庫表格清空作業] ===")
    print(f"🔒 保留的表格: {preserve_tables}")
    print(f"🗑️ 即將清空的表格: {truncate_tables}\n")

    for t in truncate_tables:
        try:
            # Using TRUNCATE CASCADE to safely empty tables while preserving schema & foreign keys if any
            cur.execute(f'TRUNCATE TABLE "{t}" CASCADE;')
            print(f"  ✅ 成功清空表格 \"{t}\" (表格結構已完全保留)")
        except Exception as e:
            print(f"  ⚠️ 清空表格 \"{t}\" 時發生錯誤: {e}")
            conn.rollback()

    conn.commit()

    print("\n--- [清空後驗證表格筆數] ---")
    for t in tables:
        cur.execute(f'SELECT COUNT(*) as cnt FROM "{t}"')
        cnt = cur.fetchone()['cnt']
        status = "🔒 [保留]" if ('AD_bank' in t or 'Q_bank' in t) else "✨ [已清空]"
        print(f"  {status} {t}: {cnt} 筆紀錄")

    cur.close()
    conn.close()
    print("\n=== 5013 資料庫表格內容清空作業順利完成 ===")

if __name__ == '__main__':
    execute_truncate()

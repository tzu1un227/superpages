import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def truncate_5013_except_banks():
    print("=== [開始執行 5013 資料庫表格清空作業] ===")
    conn = psycopg2.connect(TARGET_5013_DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. 撈取 5013 資料庫中所有的 BASE TABLE
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name ASC
    """)
    tables = [r['table_name'] for r in cur.fetchall()]

    preserved_tables = []
    truncated_tables = []
    error_tables = []

    print(f"找到 5013 資料庫中實體表格 (BASE TABLE) 共 {len(tables)} 個。\n")

    for tbl in tables:
        tbl_upper = tbl.upper()
        # 檢查是否為 AD_bank 或 Q_bank (保留不清空)
        if tbl_upper.startswith("AD_BANK") or tbl_upper.startswith("Q_BANK") or tbl_upper == "AD_BANK" or tbl_upper == "Q_BANK":
            preserved_tables.append(tbl)
            print(f"  🛡️  [保留保護] 表格 \"{tbl}\" 不清空 (保留管理者/核心規則)")
        else:
            try:
                # 執行 TRUNCATE CASCADE 清空表格資料並重置序列
                cur.execute(f'TRUNCATE TABLE "{tbl}" RESTART IDENTITY CASCADE;')
                truncated_tables.append(tbl)
                print(f"  🧹 [成功清空] 表格 \"{tbl}\" 資料已清空")
            except Exception as e:
                conn.rollback()
                print(f"  ❌ [清空失敗] 表格 \"{tbl}\": {e}")
                error_tables.append((tbl, str(e)))

    conn.commit()

    print("\n========================================================")
    print("5013 資料庫表格清空完成報告：")
    print("========================================================")
    print(f"✅ 成功清空表格數: {len(truncated_tables)} 個")
    print(f"🛡️  受保護保留表格數: {len(preserved_tables)} 個 ({preserved_tables})")
    if error_tables:
        print(f"⚠️ 失敗表格數: {len(error_tables)} 個 ({error_tables})")

    cur.close()
    conn.close()

if __name__ == '__main__':
    truncate_5013_except_banks()

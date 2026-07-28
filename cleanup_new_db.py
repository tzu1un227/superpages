import psycopg2

NEW_RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"

def cleanup():
    conn = psycopg2.connect(NEW_RDS_URL)
    cur = conn.cursor()

    # 取得除了 users, pages, permission_settings 之外的所有表格
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_type='BASE TABLE'
        AND table_name NOT IN ('users', 'pages', 'permission_settings')
    """)
    tables_to_drop = [row[0] for row in cur.fetchall()]

    print(f"Found {len(tables_to_drop)} non-primary tables to drop.")

    for tbl in tables_to_drop:
        print(f"Dropping table: {tbl}...")
        cur.execute(f'DROP TABLE IF EXISTS "{tbl}" CASCADE;')

    conn.commit()

    # 檢查剩餘的表格
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_type='BASE TABLE'
    """)
    remaining = [row[0] for row in cur.fetchall()]
    print("\nRemaining tables in superpages DB:", remaining)

    cur.close()
    conn.close()

if __name__ == '__main__':
    cleanup()

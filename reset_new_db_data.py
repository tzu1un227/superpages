import psycopg2

NEW_RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"

def reset_db_data():
    conn = psycopg2.connect(NEW_RDS_URL)
    cur = conn.cursor()

    print("Clearing permission_settings and users in 140.138.176.197/superpages...")
    
    # 清空 permission_settings（OA 配置表）
    cur.execute("TRUNCATE TABLE permission_settings RESTART IDENTITY CASCADE;")
    
    # 清空 users（使用者權限表）
    cur.execute("TRUNCATE TABLE users RESTART IDENTITY CASCADE;")

    conn.commit()

    # 驗證筆數
    cur.execute("SELECT COUNT(*) FROM permission_settings;")
    p_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM users;")
    u_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM pages;")
    pages_count = cur.fetchone()[0]

    print(f"Current counts in superpages DB -> permission_settings: {p_count}, users: {u_count}, pages: {pages_count}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    reset_db_data()

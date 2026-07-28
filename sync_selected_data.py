import psycopg2
from psycopg2.extras import RealDictCursor, Json
import sys

OLD_RDS_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
NEW_RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"

def sync_selected():
    print("Connecting to Old RDS and New Primary DB...")
    conn_src = psycopg2.connect(OLD_RDS_URL)
    cur_src = conn_src.cursor(cursor_factory=RealDictCursor)

    conn_dst = psycopg2.connect(NEW_RDS_URL)
    cur_dst = conn_dst.cursor()

    # 1. 搬移 users (指定 WH Kuo, 游承遠, 邱子倫)
    print("\n1. Migrating selected users ('WH Kuo', '游承遠', '邱子倫')...")
    cur_src.execute("SELECT * FROM users WHERE name IN ('WH Kuo', '游承遠', '邱子倫')")
    target_users = cur_src.fetchall()
    print(f"Found {len(target_users)} users in old RDS:")
    for u in target_users:
        print(f"  - ID: {u['id']}, Name: {u['name']}, Email: {u['email']}, Role: {u['role']}")

    # 2. 搬移 pages (全部)
    print("\n2. Migrating all pages...")
    cur_src.execute("SELECT * FROM pages ORDER BY id")
    target_pages = cur_src.fetchall()
    print(f"Found {len(target_pages)} pages in old RDS.")

    # 3. 搬移 permission_settings (指定 oa_name = 'superpages')
    print("\n3. Migrating permission_settings (oa_name = 'superpages')...")
    cur_src.execute("SELECT * FROM permission_settings WHERE oa_name = 'superpages'")
    target_oa = cur_src.fetchall()
    print(f"Found {len(target_oa)} oa_config in old RDS:")
    for oa in target_oa:
        print(f"  - ID: {oa['id']}, OA Name: {oa['oa_name']}, DB URL: {oa['db_url']}")

    # 4. 寫入新資料庫
    print("\nInserting data into New Primary DB (140.138.176.197/superpages)...")

    # (A) 清空新主資料庫的 3 張表
    cur_dst.execute("DELETE FROM users;")
    cur_dst.execute("DELETE FROM pages;")
    cur_dst.execute("DELETE FROM permission_settings;")
    conn_dst.commit()

    # (B) 寫入 users
    if target_users:
        cur_src.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
        u_cols = [c['column_name'] for c in cur_src.fetchall()]
        cols_str = ', '.join([f'"{c}"' for c in u_cols])
        placeholders = ', '.join(['%s'] * len(u_cols))
        insert_u = f'INSERT INTO users ({cols_str}) VALUES ({placeholders})'

        u_tuples = [tuple(Json(r[c]) if isinstance(r[c], (dict, list)) else r[c] for c in u_cols) for r in target_users]
        cur_dst.executemany(insert_u, u_tuples)
        conn_dst.commit()
        cur_dst.execute("SELECT setval(pg_get_serial_sequence('users', 'id'), coalesce(max(id), 1)) FROM users;")
        conn_dst.commit()

    # (C) 寫入 pages
    if target_pages:
        cur_src.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'pages'")
        p_cols = [c['column_name'] for c in cur_src.fetchall()]
        cols_str = ', '.join([f'"{c}"' for c in p_cols])
        placeholders = ', '.join(['%s'] * len(p_cols))
        insert_p = f'INSERT INTO pages ({cols_str}) VALUES ({placeholders})'

        p_tuples = [tuple(Json(r[c]) if isinstance(r[c], (dict, list)) else r[c] for c in p_cols) for r in target_pages]
        cur_dst.executemany(insert_p, p_tuples)
        conn_dst.commit()
        cur_dst.execute("SELECT setval(pg_get_serial_sequence('pages', 'id'), coalesce(max(id), 1)) FROM pages;")
        conn_dst.commit()

    # (D) 寫入 permission_settings
    if target_oa:
        cur_src.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'permission_settings'")
        oa_cols = [c['column_name'] for c in cur_src.fetchall()]
        cols_str = ', '.join([f'"{c}"' for c in oa_cols])
        placeholders = ', '.join(['%s'] * len(oa_cols))
        insert_oa = f'INSERT INTO permission_settings ({cols_str}) VALUES ({placeholders})'

        oa_tuples = [tuple(Json(r[c]) if isinstance(r[c], (dict, list)) else r[c] for c in oa_cols) for r in target_oa]
        cur_dst.executemany(insert_oa, oa_tuples)
        conn_dst.commit()
        cur_dst.execute("SELECT setval(pg_get_serial_sequence('permission_settings', 'id'), coalesce(max(id), 1)) FROM permission_settings;")
        conn_dst.commit()

    # 5. 驗證新主資料庫現有內容
    print("\nVerification - Current contents in New Primary DB:")
    cur_dst.execute("SELECT id, name, email, role FROM users")
    print("Users:", cur_dst.fetchall())

    cur_dst.execute("SELECT count(*) FROM pages")
    print("Pages count:", cur_dst.fetchone()[0])

    cur_dst.execute("SELECT id, oa_name, db_url FROM permission_settings")
    print("Permission Settings (OA):", cur_dst.fetchall())

    cur_src.close()
    conn_src.close()
    cur_dst.close()
    conn_dst.close()
    print("\nSelected data synchronization completed successfully!")

if __name__ == '__main__':
    sync_selected()

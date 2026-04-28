import psycopg2
import uuid
import datetime
from psycopg2.extras import RealDictCursor

RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

def insert_data():
    conn_rds = psycopg2.connect(RDS_URL)
    cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
    
    cur_rds.execute("SELECT db_url, other_settings FROM permission_settings WHERE oa_name ILIKE '%yzulabuse%'")
    oa = cur_rds.fetchone()
    
    if not oa:
        print("yzulabuse OA not found")
        return
        
    db_url = oa['db_url']
    app_name = oa['other_settings'].get('app_name', 'yzulabuse') if oa['other_settings'] else 'yzulabuse'
    
    # Connect to the target DB (which may be RDS or the legacy 5013 DB depending on db_url)
    if not db_url:
        db_url = "postgresql://postgres:0000@140.138.176.197:5432/5013"
        
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    pv_table_wrong = f'"private_var:{app_name}"'
    pv_table = f'"Private_var:{app_name}"'
    history_table = f'"history:{app_name}"'
    
    test_users = [
        {"id": "U1234567890abcdef1234567890abcdef", "name": "張大明", "pic": "https://i.pravatar.cc/150?u=1", "tag": "['VIP客戶']", "group": "['新春專案']", "phone": "0912-345-678", "email": "daming@example.com"},
        {"id": "U234567890abcdef1234567890abcdef1", "name": "李小華", "pic": "https://i.pravatar.cc/150?u=2", "tag": "['一般會員', '新春優惠']", "group": "['新春專案', '高階客群']", "phone": "0988-765-432", "email": "xiaohua@example.com"},
        {"id": "U4567890abcdef1234567890abcdef123", "name": "陳美玲", "pic": "https://i.pravatar.cc/150?u=4", "tag": "['VIP客戶', '高階保養']", "group": "['高階客群']", "phone": "0922-333-444", "email": "meiling@example.com"},
        {"id": "U567890abcdef1234567890abcdef1234", "name": "林婉容", "pic": "https://i.pravatar.cc/150?u=5", "tag": "['一般會員']", "group": "['高階客群']", "phone": "0955-666-777", "email": "wanrong@example.com"},
    ]
    
    # Drop the mistakenly created table
    cur.execute(f"DROP TABLE IF EXISTS {pv_table_wrong}")
    
    # Create tables if not exists just in case
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {pv_table} (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            name VARCHAR(255),
            value TEXT
        )
    """)
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {history_table} (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255),
            timestamp TIMESTAMP,
            category VARCHAR(100),
            content TEXT
        )
    """)
    
    # Check if data already exists
    cur.execute(f"SELECT COUNT(*) FROM {pv_table}")
    if cur.fetchone()[0] > 0:
        print("Data already exists in Private_var. Skipping test data insertion to preserve manual changes.")
        cur.close()
        conn.close()
        cur_rds.close()
        conn_rds.close()
        return
    
    gv_table = f'"Global_var:{app_name}"'
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {gv_table} (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            value TEXT
        )
    """)
    
    import json
    test_descriptions = {
        "新春專案": "針對農曆新年活動加入的受眾群體",
        "高階客群": "消費金額高且互動頻繁的VIP客戶"
    }
    
    cur.execute(f"SELECT value FROM {gv_table} WHERE name = 'group_descriptions'")
    row = cur.fetchone()
    
    if row and row[0]:
        try:
            descriptions = json.loads(row[0])
        except:
            descriptions = {}
        descriptions.update(test_descriptions)
        cur.execute(f"UPDATE {gv_table} SET value = %s WHERE name = 'group_descriptions'", (json.dumps(descriptions, ensure_ascii=False),))
    else:
        cur.execute(f"INSERT INTO {gv_table} (name, value) VALUES ('group_descriptions', %s)", (json.dumps(test_descriptions, ensure_ascii=False),))

    
    # Insert private_var
    for u in test_users:
        uid = u['id']
        cur.execute(f"DELETE FROM {pv_table} WHERE user_id = %s", (uid,))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'name', %s)", (uid, u['name']))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'pic', %s)", (uid, u['pic']))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'tag', %s)", (uid, u['tag']))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'g_group', %s)", (uid, u['group']))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'phone', %s)", (uid, u['phone']))
        cur.execute(f"INSERT INTO {pv_table} (user_id, name, value) VALUES (%s, 'email', %s)", (uid, u['email']))
        
        # Insert history (last interaction and follow event)
        days_ago = test_users.index(u) + 1
        ts = datetime.datetime.now() - datetime.timedelta(days=days_ago)
        
        # Follow event older than interaction (e.g., 10 to 400 days ago)
        join_days_ago = days_ago * 50
        join_ts = datetime.datetime.now() - datetime.timedelta(days=join_days_ago)
        
        cur.execute(f"DELETE FROM {history_table} WHERE user_id = %s", (uid,))
        cur.execute(f"INSERT INTO {history_table} (user_id, timestamp, category, content) VALUES (%s, %s, 'follow', '加入好友')", (uid, join_ts))
        cur.execute(f"INSERT INTO {history_table} (user_id, timestamp, category, content) VALUES (%s, %s, 'Message', '測試互動')", (uid, ts))
        
    conn.commit()
    cur.close()
    conn.close()
    
    cur_rds.close()
    conn_rds.close()
    
    print("Test data inserted successfully.")

if __name__ == '__main__':
    insert_data()

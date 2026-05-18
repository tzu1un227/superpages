import psycopg2
from psycopg2.extras import RealDictCursor

RDS_URL = 'postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

def test():
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT id, oa_name, db_url, other_settings FROM permission_settings')
    oas = cur.fetchall()
    print('=== QA_bank / Q_bank Index Check ===')
    for oa in oas:
        print(f"ID: {oa['id']}, Name: {oa['oa_name']}")
        db_url = oa['db_url']
        if db_url:
            try:
                conn_oa = psycopg2.connect(db_url)
                cur_oa = conn_oa.cursor()
                app_id = oa['other_settings'].get('app_name')
                if app_id:
                    # Query indexes using pg_indexes for QA_bank
                    cur_oa.execute(f"""
                        SELECT indexname, indexdef 
                        FROM pg_indexes 
                        WHERE tablename = 'QA_bank:{app_id}'
                    """)
                    print(f"  QA_bank:{app_id} indexes:")
                    rows = cur_oa.fetchall()
                    if rows:
                        for row in rows:
                            print(f"    {row[0]}: {row[1]}")
                    else:
                        print("    None")
                        
                    # Query indexes using pg_indexes for Q_bank
                    cur_oa.execute(f"""
                        SELECT indexname, indexdef 
                        FROM pg_indexes 
                        WHERE tablename = 'Q_bank:{app_id}'
                    """)
                    print(f"  Q_bank:{app_id} indexes:")
                    rows = cur_oa.fetchall()
                    if rows:
                        for row in rows:
                            print(f"    {row[0]}: {row[1]}")
                    else:
                        print("    None")
                        
                conn_oa.close()
            except Exception as e:
                print(f"  Failed: {e}")
    conn.close()

if __name__ == '__main__':
    test()

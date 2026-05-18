import psycopg2

RDS_URL = 'postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

def test():
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor()
    cur.execute('SELECT id, db_url, other_settings FROM permission_settings WHERE id=4')
    oa = cur.fetchone()
    db_url = oa[1]
    app_id = oa[2].get('app_name')
    
    conn_oa = psycopg2.connect(db_url)
    cur_oa = conn_oa.cursor()
    
    cur_oa.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'Private_var:{app_id}'
    """)
    print("=== Private_var columns ===")
    for row in cur_oa.fetchall():
        print(row)
        
    conn_oa.close()
    conn.close()

if __name__ == '__main__':
    test()

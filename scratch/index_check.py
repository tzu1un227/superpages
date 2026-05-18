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
    
    # Query all indexes on history:{app_id}
    cur_oa.execute(f"""
        SELECT
            t.relname as table_name,
            i.relname as index_name,
            a.attname as column_name
        FROM
            pg_class t,
            pg_class i,
            pg_index ix,
            pg_attribute a
        WHERE
            t.oid = ix.indrelid
            AND i.oid = ix.indexrelid
            AND a.attrelid = t.oid
            AND a.attnum = ANY(ix.indkey)
            AND t.relname = 'history:{app_id}'
    """)
    print("=== Indexes ===")
    for row in cur_oa.fetchall():
        print(row)
        
    conn_oa.close()
    conn.close()

if __name__ == '__main__':
    test()

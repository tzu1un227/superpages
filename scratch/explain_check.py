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
    
    # Original query explain plan
    q1 = f"""
        EXPLAIN ANALYZE
        SELECT p.user_id FROM "Private_var:{app_id}" p
        WHERE p.name = 'name'
        AND (
            SELECT h.category FROM "history:{app_id}" h
            WHERE h.user_id = p.user_id 
            AND h.category IN ('Follow', 'Unfollow')
            ORDER BY h.timestamp DESC LIMIT 1
        ) IS DISTINCT FROM 'Unfollow'
    """
    cur_oa.execute(q1)
    print("=== Original Query EXPLAIN ===")
    for row in cur_oa.fetchall():
        print(row[0])
        
    # LEFT JOIN LATERAL query explain plan
    q2 = f"""
        EXPLAIN ANALYZE
        SELECT p.user_id FROM "Private_var:{app_id}" p
        LEFT JOIN LATERAL (
            SELECT category FROM "history:{app_id}"
            WHERE user_id = p.user_id AND category IN ('Follow', 'Unfollow')
            ORDER BY timestamp DESC LIMIT 1
        ) h ON TRUE
        WHERE p.name = 'name' AND (h.category IS NULL OR h.category != 'Unfollow')
    """
    cur_oa.execute(q2)
    print("\n=== LEFT JOIN LATERAL EXPLAIN ===")
    for row in cur_oa.fetchall():
        print(row[0])
        
    conn_oa.close()
    conn.close()

if __name__ == '__main__':
    test()

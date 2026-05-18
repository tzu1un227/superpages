import psycopg2
from psycopg2.extras import RealDictCursor
import time

RDS_URL = 'postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

def test():
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT id, oa_name, db_url, other_settings FROM permission_settings')
    oas = cur.fetchall()
    print('=== OAs ===')
    for oa in oas:
        print(f"ID: {oa['id']}, Name: {oa['oa_name']}, AppName: {oa['other_settings'].get('app_name') if oa['other_settings'] else 'None'}")
        db_url = oa['db_url']
        if db_url:
            try:
                conn_oa = psycopg2.connect(db_url)
                cur_oa = conn_oa.cursor()
                app_id = oa['other_settings'].get('app_name')
                if app_id:
                    cur_oa.execute(f"SELECT count(*) FROM \"Private_var:{app_id}\" WHERE name='name'")
                    p_count = cur_oa.fetchone()[0]
                    cur_oa.execute(f"SELECT count(*) FROM \"history:{app_id}\"")
                    h_count = cur_oa.fetchone()[0]
                    print(f"  Private_var count: {p_count}, History count: {h_count}")
                    
                    # Test original active_user_subquery speed
                    q1 = f"""
                        SELECT p.user_id FROM "Private_var:{app_id}" p
                        WHERE p.name = 'name'
                        AND (
                            SELECT h.category FROM "history:{app_id}" h
                            WHERE h.user_id = p.user_id 
                            AND h.category IN ('Follow', 'Unfollow')
                            ORDER BY h.timestamp DESC LIMIT 1
                        ) IS DISTINCT FROM 'Unfollow'
                    """
                    t0 = time.time()
                    cur_oa.execute(q1)
                    res1 = cur_oa.fetchall()
                    t1 = time.time()
                    print(f"  Original Query: {len(res1)} users, Time: {t1 - t0:.4f}s")
                    
                    # Test optimized query with LEFT JOIN LATERAL
                    q2 = f"""
                        SELECT p.user_id FROM "Private_var:{app_id}" p
                        LEFT JOIN LATERAL (
                            SELECT category FROM "history:{app_id}"
                            WHERE user_id = p.user_id AND category IN ('Follow', 'Unfollow')
                            ORDER BY timestamp DESC LIMIT 1
                        ) h ON TRUE
                        WHERE p.name = 'name' AND (h.category IS NULL OR h.category != 'Unfollow')
                    """
                    t0 = time.time()
                    cur_oa.execute(q2)
                    res2 = cur_oa.fetchall()
                    t1 = time.time()
                    print(f"  LEFT JOIN LATERAL: {len(res2)} users, Time: {t1 - t0:.4f}s")
                    
                    # Test optimized query with LEFT JOIN DISTINCT ON
                    q3 = f"""
                        SELECT p.user_id FROM "Private_var:{app_id}" p
                        LEFT JOIN (
                            SELECT DISTINCT ON (user_id) user_id, category
                            FROM "history:{app_id}"
                            WHERE category IN ('Follow', 'Unfollow')
                            ORDER BY user_id, timestamp DESC
                        ) h ON p.user_id = h.user_id
                        WHERE p.name = 'name' AND (h.category IS NULL OR h.category != 'Unfollow')
                    """
                    t0 = time.time()
                    cur_oa.execute(q3)
                    res3 = cur_oa.fetchall()
                    t1 = time.time()
                    print(f"  LEFT JOIN DISTINCT ON: {len(res3)} users, Time: {t1 - t0:.4f}s")
                    
                conn_oa.close()
            except Exception as e:
                print(f"  Failed to connect/query: {e}")
    conn.close()

if __name__ == '__main__':
    test()

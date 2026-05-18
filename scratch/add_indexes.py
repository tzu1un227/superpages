import psycopg2
from psycopg2.extras import RealDictCursor
import time

RDS_URL = 'postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

def migrate():
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT id, oa_name, db_url, other_settings FROM permission_settings')
    oas = cur.fetchall()
    print('=== Starting Index Migration ===')
    for oa in oas:
        print(f"ID: {oa['id']}, Name: {oa['oa_name']}, AppName: {oa['other_settings'].get('app_name') if oa['other_settings'] else 'None'}")
        db_url = oa['db_url']
        if db_url:
            try:
                conn_oa = psycopg2.connect(db_url)
                cur_oa = conn_oa.cursor()
                app_id = oa['other_settings'].get('app_name')
                if app_id:
                    # 1. Create index on Private_var name
                    print(f"  Creating indexes on Private_var:{app_id}...")
                    cur_oa.execute(f'CREATE INDEX IF NOT EXISTS "idx_pvar_name_{app_id}" ON "Private_var:{app_id}" (name)')
                    cur_oa.execute(f'CREATE INDEX IF NOT EXISTS "idx_pvar_user_name_{app_id}" ON "Private_var:{app_id}" (user_id, name)')
                    
                    # 2. Create index on history user_id and category
                    print(f"  Creating indexes on history:{app_id}...")
                    cur_oa.execute(f'CREATE INDEX IF NOT EXISTS "idx_history_user_cat_ts_{app_id}" ON "history:{app_id}" (user_id, category, timestamp DESC)')
                    cur_oa.execute(f'CREATE INDEX IF NOT EXISTS "idx_history_user_ts_{app_id}" ON "history:{app_id}" (user_id, timestamp DESC)')
                    
                    conn_oa.commit()
                    print(f"  Successfully migrated indexes for {oa['oa_name']}")
                    
                    # Verify query speed after index creation
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
                    print(f"  Verified query speed: {len(res1)} users, Time: {t1 - t0:.4f}s (was 0.3245s for 7 users)")
                conn_oa.close()
            except Exception as e:
                print(f"  Failed during migration: {e}")
    conn.close()

if __name__ == '__main__':
    migrate()

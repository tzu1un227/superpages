import psycopg2
from psycopg2.extras import RealDictCursor

RDS_URL = 'postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

def migrate():
    conn = psycopg2.connect(RDS_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute('SELECT id, oa_name, db_url, other_settings FROM permission_settings')
    oas = cur.fetchall()
    print('=== Starting Q_bank/QA_bank Index Migration ===')
    for oa in oas:
        print(f"ID: {oa['id']}, Name: {oa['oa_name']}, AppName: {oa['other_settings'].get('app_name') if oa['other_settings'] else 'None'}")
        db_url = oa['db_url']
        if db_url:
            try:
                conn_oa = psycopg2.connect(db_url)
                cur_oa = conn_oa.cursor()
                app_id = oa['other_settings'].get('app_name')
                if app_id:
                    # 1. Primary key check / creation for Q_bank and QA_bank
                    print(f"  Ensuring primary keys for {app_id}...")
                    try:
                        cur_oa.execute(f'ALTER TABLE "Q_bank:{app_id}" ADD PRIMARY KEY (id)')
                        print("    Added PK to Q_bank")
                    except Exception:
                        conn_oa.rollback()
                        cur_oa = conn_oa.cursor()
                        
                    try:
                        cur_oa.execute(f'ALTER TABLE "QA_bank:{app_id}" ADD PRIMARY KEY (id)')
                        print("    Added PK to QA_bank")
                    except Exception:
                        conn_oa.rollback()
                        cur_oa = conn_oa.cursor()
                    
                    # 2. Index on tag in QA_bank
                    print(f"  Creating indexes on QA_bank:{app_id}...")
                    cur_oa.execute(f'CREATE INDEX IF NOT EXISTS "idx_qabank_tag_{app_id}" ON "QA_bank:{app_id}" (tag)')
                    
                    conn_oa.commit()
                    print(f"  Successfully migrated Q_bank/QA_bank indexes for {oa['oa_name']}")
                conn_oa.close()
            except Exception as e:
                print(f"  Failed during migration: {e}")
    conn.close()

if __name__ == '__main__':
    migrate()


import psycopg2
from psycopg2.extras import RealDictCursor

RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

def find_5013():
    try:
        conn = psycopg2.connect(RDS_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings")
        rows = cur.fetchall()
        for row in rows:
            app_name = row['other_settings'].get('app_name') if row['other_settings'] else None
            if '5013' in str(row['oa_name']) or app_name == '5013':
                print(f"MATCH FOUND: ID={row['id']}, Name={row['oa_name']}, URL={row['db_url']}, AppName={app_name}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_5013()

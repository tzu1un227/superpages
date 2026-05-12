
import psycopg2

RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

def final_cleanup():
    try:
        conn = psycopg2.connect(RDS_URL)
        cur = conn.cursor()
        cur.execute("DELETE FROM pages WHERE name = 'PrizeStatus'")
        conn.commit()
        print("Final database cleanup successful (PrizeStatus deleted from pages table).")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    final_cleanup()

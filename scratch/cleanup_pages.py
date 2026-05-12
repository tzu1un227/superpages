
import psycopg2
import json

RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

def cleanup():
    try:
        conn = psycopg2.connect(RDS_URL)
        cur = conn.cursor()
        
        # Fetch all permission settings
        cur.execute("SELECT id, pages FROM permission_settings")
        rows = cur.fetchall()
        
        for row_id, pages_json in rows:
            if not pages_json: continue
            
            # Filter out PrizeStatus
            new_pages = [p for p in pages_json if p.get('name') != 'PrizeStatus']
            
            if len(new_pages) != len(pages_json):
                print(f"Updating OA ID {row_id}: Removing PrizeStatus")
                cur.execute("UPDATE permission_settings SET pages = %s WHERE id = %s", (json.dumps(new_pages), row_id))
        
        conn.commit()
        print("Database cleanup successful.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()

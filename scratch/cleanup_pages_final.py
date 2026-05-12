
import psycopg2
import json

RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

def cleanup():
    try:
        conn = psycopg2.connect(RDS_URL)
        cur = conn.cursor()
        
        # 1. Find the ID of 'PrizeStatus'
        cur.execute("SELECT id FROM pages WHERE name = 'PrizeStatus'")
        result = cur.fetchone()
        if not result:
            print("PrizeStatus page not found. Maybe already deleted?")
            # Even if not found, we should still clean up any leftover invalid IDs
            prize_id = None
        else:
            prize_id = result[0]
            print(f"Found PrizeStatus ID: {prize_id}")
            # Optional: Delete the page entry itself
            # cur.execute("DELETE FROM pages WHERE id = %s", (prize_id,))
        
        # 2. Update permission_settings
        cur.execute("SELECT id, page_ids FROM permission_settings")
        rows = cur.fetchall()
        
        for row_id, page_ids in rows:
            if not page_ids: continue
            
            # Remove prize_id from the list
            new_page_ids = [pid for pid in page_ids if pid != prize_id]
            
            if len(new_page_ids) != len(page_ids):
                print(f"Updating OA ID {row_id}: Removing page ID {prize_id}")
                cur.execute("UPDATE permission_settings SET page_ids = %s WHERE id = %s", (json.dumps(new_page_ids), row_id))
        
        conn.commit()
        print("Database cleanup successful.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    cleanup()

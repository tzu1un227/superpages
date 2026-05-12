
import psycopg2

DB_URL_5013 = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def force_sync_5013():
    try:
        conn = psycopg2.connect(DB_URL_5013)
        cur = conn.cursor()
        
        # 1. Drop and recreate ht_view:5013
        print("Dropping and recreating ht_view:5013...")
        cur.execute("DROP VIEW IF EXISTS \"ht_view:5013\" CASCADE")
        cur.execute(f"""
            CREATE VIEW \"ht_view:5013\" AS
            SELECT h.*, v.value as tag
            FROM \"history:5013\" h
            LEFT JOIN \"Private_var:5013\" v ON h.user_id = v.user_id AND v.name = 'tag'
        """)
        
        # 2. Recreate functions
        print("Recreating statistics functions...")
        cur.execute("DROP FUNCTION IF EXISTS get_keyword_ranking(timestamp, timestamp, text, integer, text)")
        cur.execute("""
            CREATE OR REPLACE FUNCTION get_keyword_ranking(s_time timestamp, e_time timestamp, cat text, lim integer, app text)
            RETURNS TABLE(content text, count bigint) AS $$
            BEGIN
                RETURN QUERY
                EXECUTE format('SELECT content, COUNT(*) as count FROM "history:%s" WHERE timestamp >= $1 AND timestamp <= $2 AND category = $3 GROUP BY content ORDER BY count DESC LIMIT $4', app)
                USING s_time, e_time, cat, lim;
            END;
            $$ LANGUAGE plpgsql;
        """)

        conn.commit()
        print("5013 structures updated successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error syncing 5013: {e}")

if __name__ == "__main__":
    force_sync_5013()

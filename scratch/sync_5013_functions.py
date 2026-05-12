
import psycopg2

DB_URL_5013 = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def sync_db_structures():
    try:
        conn = psycopg2.connect(DB_URL_5013)
        cur = conn.cursor()
        
        # 1. Create ht_view:5013
        print("Creating ht_view:5013...")
        cur.execute(f"""
            CREATE OR REPLACE VIEW "ht_view:5013" AS
            SELECT h.*, v.value as tag
            FROM "history:5013" h
            LEFT JOIN "Private_var:5013" v ON h.user_id = v.user_id AND v.name = 'tag'
        """)
        
        # 2. Create helper functions (simplified versions for statistics)
        print("Creating statistics functions...")
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

        cur.execute("""
            CREATE OR REPLACE FUNCTION get_events_count_by_category_and_tag(s_time timestamp, e_time timestamp, cat text, unit text, app text)
            RETURNS TABLE(group_key text, tag text, tag_count bigint) AS $$
            BEGIN
                RETURN QUERY
                EXECUTE format('
                    SELECT to_char(timestamp, $1) as group_key, v.value as tag, COUNT(*) as tag_count 
                    FROM "history:%s" h 
                    LEFT JOIN "Private_var:%s" v ON h.user_id = v.user_id AND v.name = ''tag''
                    WHERE h.timestamp >= $2 AND h.timestamp <= $3 AND h.category = $4
                    GROUP BY group_key, tag', app, app)
                USING (CASE WHEN unit='day' THEN 'YYYY-MM-DD' ELSE 'YYYY-MM' END), s_time, e_time, cat;
            END;
            $$ LANGUAGE plpgsql;
        """)

        conn.commit()
        print("5013 functions and views synced.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error syncing 5013: {e}")

if __name__ == "__main__":
    sync_db_structures()

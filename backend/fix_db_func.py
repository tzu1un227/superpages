import psycopg2

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

NEW_FUNC_SQL = """
CREATE OR REPLACE FUNCTION get_events_count_by_category_and_tag(
    start_time timestamptz,
    end_time timestamptz,
    _category text,
    group_unit text DEFAULT 'day'
)
RETURNS TABLE(group_key text, tag text, tag_count bigint) AS $$
BEGIN
    RETURN QUERY
    WITH GroupedEvents AS (
        SELECT
            CASE
                WHEN group_unit IN ('年', 'year') THEN to_char(v."timestamp", 'YYYY')
                WHEN group_unit IN ('月', 'month') THEN to_char(v."timestamp", 'YYYY-MM')
                WHEN group_unit IN ('週', 'week') THEN
                    to_char(date_trunc('week', v."timestamp"), 'YYYY-MM-DD') || ' ~ ' ||
                    to_char(date_trunc('week', v."timestamp") + INTERVAL '6 days', 'YYYY-MM-DD')
                WHEN group_unit IN ('日', 'day') THEN to_char(v."timestamp", 'YYYY-MM-DD')
                ELSE 'UNDEFINED'
            END AS group_key,
            
            unnest(
                CASE 
                    WHEN v.tag LIKE '[%' THEN 
                        ARRAY(
                            -- 這裡加上 REPLACE 將單引號轉為雙引號，以支持 Python-style list 字串
                            SELECT jsonb_array_elements_text(REPLACE(v.tag, '''', '"')::jsonb)
                        )
                    WHEN v.tag LIKE '{%' THEN 
                        v.tag::text[]
                    WHEN v.tag = '' THEN
                        ARRAY['(無標籤)']
                    ELSE 
                        ARRAY[v.tag]
                END
            ) AS tag, 
            
            v.user_id AS user_id
        FROM static_view v
        WHERE v."timestamp" >= start_time
          AND v."timestamp" <= end_time
          AND (
              LOWER(_category) = 'user'        
              OR LOWER(v.category) = LOWER(_category) 
          )
    )
    SELECT
        ge.group_key,
        ge.tag AS tag,
        
        CASE
            WHEN LOWER(_category) = 'user' THEN
                COUNT(DISTINCT ge.user_id)
            ELSE
                COUNT(*)
        END AS tag_count

    FROM GroupedEvents ge
    GROUP BY
        ge.group_key,
        ge.tag
    ORDER BY group_key, tag;
END;
$$ LANGUAGE plpgsql;
"""

def fix_function():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("Updating get_events_count_by_category_and_tag...")
        cur.execute(NEW_FUNC_SQL)
        conn.commit()
        print("Function updated successfully.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error updating function: {e}")

if __name__ == "__main__":
    fix_function()

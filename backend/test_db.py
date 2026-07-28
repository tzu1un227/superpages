import psycopg2

RDS_URL = "postgresql://postgres:0000@140.138.176.197:5432/superpages"
conn = psycopg2.connect(RDS_URL)
cur = conn.cursor()

app_id = 'yzulabuse'

active_user_query = f"""
    SELECT p.user_id FROM "Private_var:{app_id}" p
    WHERE p.name = 'name'
    AND (
        SELECT h.category FROM "history:{app_id}" h
        WHERE h.user_id = p.user_id 
        AND h.category IN ('Follow', 'Unfollow')
        ORDER BY h.timestamp DESC LIMIT 1
    ) IS DISTINCT FROM 'Unfollow'
    AND length(p.user_id) = 33 AND p.user_id LIKE 'U%%'
"""

try:
    cur.execute(active_user_query)
    rows = cur.fetchall()
    print("Found active user IDs:")
    for row in rows:
        print(row[0])
except Exception as e:
    print("SQL Error:", str(e))

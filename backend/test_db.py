import psycopg2

RDS_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
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

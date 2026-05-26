import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from backend.app import app
from backend.db_utils import get_db_connection
from psycopg2.extras import RealDictCursor

with app.app_context():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    query = """
    SELECT * FROM "history:yzulabuse" 
    WHERE content LIKE '%456++%' 
    AND (LOWER(category) NOT IN ('sensor', 'postback', 'follow', 'unfollow', 'beacon', 'cron', 'bmcast') OR category IS NULL) 
    AND (content IS NULL OR (content NOT LIKE 'bmcast|%%' AND content NOT LIKE 'QA|%%' AND content NOT LIKE 'set_tag|%%' AND content NOT LIKE 'del_tag|%%' AND content NOT LIKE 'cron|%%')) 
    ORDER BY timestamp DESC LIMIT 10
    """
    cur.execute(query)
    res = cur.fetchall()
    print(f"Total rows found with filter: {len(res)}")
    for r in res:
        print(dict(r))

# -*- coding: utf-8 -*-
import json
from db_utils import get_main_db_connection, get_db_connection
from psycopg2.extras import RealDictCursor

conn = get_main_db_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings WHERE id = 7")
row = cur.fetchone()

print(f"OA Name: {row['oa_name']}")
print(f"DB URL: {row['db_url']}")
settings = row['other_settings']
if isinstance(settings, str): settings = json.loads(settings)
app_name = settings.get('app_name') if settings else None
print(f"App Name: {app_name}")

if row['db_url']:
    try:
        t_conn = get_db_connection(row['db_url'])
        t_cur = t_conn.cursor()
        t_cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = 'Private_var:{app_name}'")
        exists = t_cur.fetchone() is not None
        print(f"Private_var:{app_name} exists: {exists}")
    except Exception as e:
        print(f"Error connecting to tenant DB: {e}")

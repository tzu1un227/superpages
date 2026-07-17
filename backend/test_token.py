# -*- coding: utf-8 -*-
import json
from db_utils import get_main_db_connection
conn = get_main_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, other_settings FROM permission_settings WHERE (other_settings::jsonb ->> 'app_name') = 'yzuirl01' LIMIT 1")
row = cur.fetchone()
settings = row[1]
if isinstance(settings, str): settings = json.loads(settings)
print(f'Token exists: {"line_token" in settings}')

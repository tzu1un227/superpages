import sys
sys.path.append('backend')
from db_utils import get_main_db_connection

conn = get_main_db_connection()
cur = conn.cursor()
cur.execute("SELECT other_settings FROM permission_settings WHERE oa_name = %s", ('yzulabuse',))
row = cur.fetchone()
print('row:', row)
if row and row[0]:
    settings = row[0]
    print('settings type:', type(settings))
    print('settings:', settings)
    if isinstance(settings, str):
        import json
        settings = json.loads(settings)
    print('token:', settings.get('line_token'))

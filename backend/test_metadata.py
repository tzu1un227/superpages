import json
from utils.db_utils import get_main_db_connection

conn = get_main_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, status, name, rich_menu_id FROM \"rich_menu_metadata:tzu1un227/superpages\"")
print(cur.fetchall())
conn.close()

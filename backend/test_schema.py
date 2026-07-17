# -*- coding: utf-8 -*-
from db_utils import get_main_db_connection
conn = get_main_db_connection()
cur = conn.cursor()
cur.execute('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \'rich_menu_metadata:yzuirl01\'')
for row in cur.fetchall():
    print(f'{row[0]}: {row[1]}')

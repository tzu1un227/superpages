# -*- coding: utf-8 -*-
from flask import Flask
from db_utils import get_main_db_connection
app = Flask(__name__)
with app.app_context():
    conn = get_main_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, status FROM \"rich_menu_metadata:yzuirl01\" WHERE rich_menu_id = 'richmenu-d7c161f8abef525e4ea504f941ca0a93'")
    row = cur.fetchone()
    print('Menu:', row)

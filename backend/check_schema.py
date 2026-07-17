# -*- coding: utf-8 -*-
from flask import Flask
from db_utils import get_main_db_connection
app = Flask(__name__)
with app.app_context():
    conn = get_main_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, status, start_time, end_time FROM \"rich_menu_metadata:yzuirl01\"")
    for r in cur.fetchall():
        print(r)

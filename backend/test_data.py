# -*- coding: utf-8 -*-
import json
from flask import Flask
from db_utils import get_main_db_connection
app = Flask(__name__)
with app.app_context():
    conn = get_main_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT data FROM \"rich_menu_metadata:yzuirl01\" WHERE id = 162")
    row = cur.fetchone()
    print(json.dumps(row[0], indent=2, ensure_ascii=False))

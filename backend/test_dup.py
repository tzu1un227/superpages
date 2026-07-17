# -*- coding: utf-8 -*-
from flask import Flask
from db_utils import get_main_db_connection
app = Flask(__name__)
with app.app_context():
    conn = get_main_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, oa_name, db_url FROM permission_settings WHERE oa_name = 'yzuirl01' OR (other_settings::jsonb ->> 'app_name') = 'yzuirl01'")
    rows = cur.fetchall()
    print('Found rows:', rows)

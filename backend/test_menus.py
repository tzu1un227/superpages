# -*- coding: utf-8 -*-
from flask import Flask
from db_utils import get_main_db_connection
import json

app = Flask(__name__)
with app.app_context():
    conn = get_main_db_connection()
    cur = conn.cursor()
    
    app_name = "yzuirl01"
    t_metadata = f'"rich_menu_metadata:{app_name}"'
    
    cur.execute(f"SELECT id, status, start_time, end_time, updated_at FROM {t_metadata} ORDER BY updated_at DESC LIMIT 5")
    rows = cur.fetchall()
    
    print("Recent menus for yzuirl01:")
    for r in rows:
        print(r)

# -*- coding: utf-8 -*-
from flask import Flask
from db_utils import get_db_connection
app = Flask(__name__)
with app.app_context():
    app_name = 'yzuirl01'
    db_url = 'postgres://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2'
    tenant_conn = get_db_connection(db_url)
    tenant_cur = tenant_conn.cursor()
    
    tenant_cur.execute(f"SELECT user_id, name, value FROM \"Private_var:{app_name}\" WHERE name = 'tag' OR value = '1'")
    rows = tenant_cur.fetchall()
    
    user_tags = {}
    for uid, name, val in rows:
        if uid not in user_tags: user_tags[uid] = []
        user_tags[uid].append((name, val))
        
    for uid, tags in list(user_tags.items())[:5]:
        print(f"User {uid}: {tags}")

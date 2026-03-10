
import sys
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import json

app = Flask(__name__)
DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}
app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
db = SQLAlchemy(app)

class OAConfig(db.Model):
    __tablename__ = 'permission_settings'
    id = db.Column(db.Integer, primary_key=True)
    oa_name = db.Column(db.String(100), nullable=False)
    other_settings = db.Column(db.JSON, nullable=True)

with app.app_context():
    oa = OAConfig.query.filter(OAConfig.oa_name.ilike('%yzulabuse%')).first()
    if oa:
        print(f"OA: {oa.oa_name}")
        print(f"Other Settings: {json.dumps(oa.other_settings, indent=2)}")
    else:
        print("yzulabuse not found.")

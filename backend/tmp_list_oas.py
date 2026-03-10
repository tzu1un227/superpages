
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
    oas = OAConfig.query.all()
    for oa in oas:
        print(f"ID: {oa.id} | OA: {oa.oa_name} | App Name: {oa.other_settings.get('app_name') if oa.other_settings else 'N/A'}")

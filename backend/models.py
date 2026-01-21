from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user')  # 'admin' or 'user'
    allowed_oa_configs = db.Column(db.JSON, nullable=True, default=[])  # JSON list of oa_config IDs, e.g., [1, 2]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Page(db.Model):
    __tablename__ = 'pages'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.String(200), nullable=True)
    
    # 關聯到 OA 設定
    oa_configs = db.relationship('OAConfig', backref='page', lazy=True)

class OAConfig(db.Model):
    __tablename__ = 'oa_configs'
    id = db.Column(db.Integer, primary_key=True)
    page_id = db.Column(db.Integer, db.ForeignKey('pages.id'), nullable=False)
    oa_name = db.Column(db.String(100), nullable=False)
    db_url = db.Column(db.String(500), nullable=False)  # 遠端 DB URL
    other_settings = db.Column(db.JSON, nullable=True)  # 頁面特定設定
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

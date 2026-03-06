
import sys
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import psycopg2
from psycopg2.extras import RealDictCursor

# Mock Flask for SQLAlchemy models
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
    db_url = db.Column(db.String(500), nullable=True)
    other_settings = db.Column(db.JSON, nullable=True)

with app.app_context():
    # Only check yzulabuse
    oa = OAConfig.query.filter_by(oa_name='yzulabuse').first()
    if not oa:
        # Try generic name if needed or search matching
        print("yzulabuse not found by exact name, trying search...")
        oa = OAConfig.query.filter(OAConfig.oa_name.ilike('%yzulabuse%')).first()
        
    if oa:
        print(f"OA Found: ID: {oa.id}, Name: {oa.oa_name}, DB URL: {oa.db_url}")
        if oa.db_url:
            try:
                conn = psycopg2.connect(oa.db_url)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects' ORDER BY ordinal_position")
                cols = cur.fetchall()
                print(f"  Schema for 'projects' in {oa.oa_name}:")
                if not cols:
                    print("    Table 'projects' does NOT exist!")
                for col in cols:
                    print(f"    - {col['column_name']} ({col['data_type']})")
                
                # Check for rows
                cur.execute("SELECT * FROM projects LIMIT 10")
                rows = cur.fetchall()
                print(f"  Rows in 'projects' ({len(rows)}):")
                for row in rows:
                    print(f"    {row}")
                
                cur.close()
                conn.close()
            except Exception as e:
                print(f"  Error checking DB for {oa.oa_name}: {e}")
    else:
        print("yzulabuse record not found in permission_settings.")
    

import sys
import os

# Add the current directory to sys.path to import from backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app import app
from models import db, OAConfig

with app.app_context():
    oas = OAConfig.query.all()
    print(f"Total OAConfigs: {len(oas)}")
    for oa in oas:
        print(f"ID: {oa.id}, Name: {oa.oa_name}, DB_URL host: {oa.db_url.split('@')[-1] if oa.db_url else 'None'}")

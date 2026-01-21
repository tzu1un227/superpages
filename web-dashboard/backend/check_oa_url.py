from app import create_app
from models import OAConfig

app = create_app()
with app.app_context():
    oa = OAConfig.query.filter_by(oa_name='test').first()
    if oa:
        print(f"OA Name: {oa.oa_name}")
        print(f"DB URL: '{oa.db_url}'")
        print(f"Bytes: {oa.db_url.encode('utf-8')}")
    else:
        print("OA 'test' not found")

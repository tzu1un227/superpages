from app import create_app
from models import OAConfig

app = create_app()
with app.app_context():
    oa = OAConfig.query.filter_by(oa_name='test').first()
    url = oa.db_url
    print(f"URL: {url}")
    print(f"Starts with postgresql:// : {url.startswith('postgresql://')}")
    print(f"Starts with postgres:// : {url.startswith('postgres://')}")
    
    # Check for number of slashes after scheme
    if '://' in url:
        print("Scheme separator '://' FOUND")
    elif ':/' in url:
        print("Scheme separator ':/' FOUND (Possible Issue)")
    else:
        print("No scheme separator found")

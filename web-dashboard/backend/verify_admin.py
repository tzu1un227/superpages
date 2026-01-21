import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from app import create_app
    from models import db, User
    from auth import generate_token
    import json
    
    app = create_app()
    print(f"DEBUG: DB URI = {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    with app.app_context():
        # Admin should already exist from init_db.py
        admin_email = 'wenhsing.kuo@gmail.com'
        admin = User.query.filter_by(email=admin_email).first()
        
        if not admin:
            print(f"VERIFICATION FAILED: Admin user {admin_email} not found in DB.")
            sys.exit(1)
            
        token = generate_token(admin.id)
        print(f"DEBUG: Token type: {type(token)}")
        print(f"DEBUG: Token: {token}")
        
        client = app.test_client()
        headers = {'Authorization': f'Bearer {token}'}
        
        response = client.get('/admin/users', headers=headers)
        print(f"Response Status: {response.status_code}")
        with open('verification_result.txt', 'w') as f:
            f.write(f"Status: {response.status_code}\n")
            f.write(f"Body: {response.get_json()}\n")
        
        if response.status_code == 200:
            print("VERIFICATION SUCCESS: Admin API accessible.")
        else:
            print("VERIFICATION FAILED: Admin API returned error.")
            
except Exception as e:
    print(f"VERIFICATION ERROR: {e}")
    import traceback
    traceback.print_exc()

finally:
    if 'db_path' in locals() and os.path.exists(db_path):
        os.remove(db_path)

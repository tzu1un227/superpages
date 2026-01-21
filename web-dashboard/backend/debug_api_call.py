from app import create_app
from models import User, OAConfig

app = create_app()

# Mocking authentication is hard without a valid token, 
# but we can manually call the controller function if we bypass the decorator 
# or simpler: Generate a token for the admin user and use it.

from auth import generate_token

with app.app_context():
    admin = User.query.filter_by(role='admin').first()
    if not admin:
        print("No admin user found")
        exit(1)
        
    token = generate_token(admin)
    
    # Test OA ID 2 (which is 'test')
    oa_id = 2
    
    print(f"Testing Dashboard API for Account {oa_id} with Admin token...")
    
    with app.test_client() as client:
        # User Trend
        start_date = '2024-01-01'
        end_date = '2025-12-31'
        res = client.get(f'/dashboard/user_trend?account={oa_id}&period=週&data_type=Message&start_date={start_date}&end_date={end_date}', 
                         headers={'Authorization': f'Bearer {token}'})
        print(f"User Trend Status: {res.status_code}")
        if res.status_code != 200:
            print(f"User Trend Error: {res.data}")
        else:
            print("User Trend Data (preview):", str(res.json)[:100])
            
        # Keyword Ranking
        res = client.get(f'/dashboard/responses?account={oa_id}&tag=&limit=50',
                         headers={'Authorization': f'Bearer {token}'})
        print(f"Keyword Status: {res.status_code}")
        if res.status_code != 200:
            print(f"Keyword Error: {res.data}")
        else:
            print("Keyword Data (preview):", str(res.json)[:100])

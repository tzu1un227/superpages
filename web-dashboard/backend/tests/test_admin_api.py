import pytest
from app import create_app
from models import db, User, OAConfig
from auth import generate_token
import json

@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            yield client
            db.drop_all()

def test_admin_access(client):
    # Create Admin User
    with client.application.app_context():
        admin = User(email='admin@test.com', role='admin')
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id
        token = generate_token(admin_id)

    headers = {'Authorization': f'Bearer {token}'}
    
    # Test GET Users
    response = client.get('/admin/users', headers=headers)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) == 1
    assert data[0]['email'] == 'admin@test.com'

    # Test Create User
    new_user_data = {'email': 'new@test.com', 'role': 'user'}
    response = client.post('/admin/users', json=new_user_data, headers=headers)
    assert response.status_code == 201
    
    # Verify User Created
    with client.application.app_context():
        user = User.query.filter_by(email='new@test.com').first()
        assert user is not None
        assert user.role == 'user'

def test_unauthorized_access(client):
    # Create Regular User
    with client.application.app_context():
        user = User(email='user@test.com', role='user')
        db.session.add(user)
        db.session.commit()
        token = generate_token(user.id)
        
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test Admin Access Denied
    response = client.get('/admin/users', headers=headers)
    assert response.status_code == 403

def test_oa_config_crud(client):
    # Create Admin
    with client.application.app_context():
        admin = User(email='admin@test.com', role='admin')
        # Create Dummy Page
        from models import Page
        page = Page(name='dashboard')
        db.session.add(admin)
        db.session.add(page)
        db.session.commit()
        token = generate_token(admin.id)
        
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test Create OA Config
    oa_data = {
        'page_id': 1,
        'oa_name': 'Test OA',
        'db_url': 'postgresql://...',
        'other_settings': {'theme': 'dark'}
    }
    response = client.post('/admin/oa_configs', json=oa_data, headers=headers)
    assert response.status_code == 201
    
    # Test Get OA Configs
    response = client.get('/admin/oa_configs', headers=headers)
    assert response.status_code == 200
    data = json.loads(response.data)
    assert len(data) == 1
    assert data[0]['oa_name'] == 'Test OA'

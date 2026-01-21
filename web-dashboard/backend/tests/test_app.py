import json
import jwt
from unittest.mock import patch
from config import Config
from models import User, db

def test_db_connection(client):
    """Test the /test_db endpoint."""
    response = client.get('/test_db')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'status' in data

def test_google_login_success(client, app):
    """Test successful Google login with authorized user."""
    with app.app_context():
        # Ensure test user exists
        user = User.query.filter_by(email='user@example.com').first()
        if not user:
            user = User(email='user@example.com', role='user', allowed_oa_configs=['oa1'])
            db.session.add(user)
            db.session.commit()
        
        # Mock Google token verification
        with patch('google.oauth2.id_token.verify_oauth2_token') as mock_verify:
            mock_verify.return_value = {'email': 'user@example.com'}
            
            response = client.post('/auth/google-login', json={'token': 'valid_token'})
            assert response.status_code == 200
            data = json.loads(response.data)
            assert 'token' in data
            assert 'user' in data
            assert data['user']['email'] == 'user@example.com'

def test_google_login_unauthorized(client, app):
    """Test Google login with unauthorized user."""
    with patch('google.oauth2.id_token.verify_oauth2_token') as mock_verify:
        mock_verify.return_value = {'email': 'unauthorized@example.com'}
        
        response = client.post('/auth/google-login', json={'token': 'valid_token'})
        assert response.status_code == 403
        data = json.loads(response.data)
        assert '未被授權' in data['message']

def test_google_login_invalid_token(client):
    """Test Google login with invalid token."""
    with patch('google.oauth2.id_token.verify_oauth2_token') as mock_verify:
        mock_verify.side_effect = ValueError('Invalid token')
        
        response = client.post('/auth/google-login', json={'token': 'invalid_token'})
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Invalid token' in data['message']

def test_protected_endpoints_without_token(client):
    """Test that protected endpoints return 401 without JWT."""
    response = client.get('/dashboard/user_trend')
    assert response.status_code == 401
    
    response = client.get('/dashboard/responses')
    assert response.status_code == 401

def test_protected_endpoints_with_invalid_token(client):
    """Test that protected endpoints return 401 with invalid JWT."""
    headers = {'Authorization': 'Bearer invalid_token'}
    response = client.get('/dashboard/user_trend', headers=headers)
    assert response.status_code == 401
    
    response = client.get('/dashboard/responses', headers=headers)
    assert response.status_code == 401

def test_protected_endpoints_with_valid_token(client, app):
    """Test that protected endpoints work with valid JWT."""
    with app.app_context():
        user = User.query.filter_by(email='user@example.com').first()
        if not user:
            user = User(email='user@example.com', role='user', allowed_oa_configs=['oa1'])
            db.session.add(user)
            db.session.commit()
        
        payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'allowed_oa_configs': user.allowed_oa_configs
        }
        token = jwt.encode(payload, Config.JWT_SECRET_KEY, algorithm='HS256')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Note: These will fail if remote DB is not accessible, but JWT auth should pass
        response = client.get('/dashboard/user_trend', headers=headers)
        # Assert JWT auth passes (status not 401)
        assert response.status_code != 401

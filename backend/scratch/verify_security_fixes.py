import sys
import os
import unittest
from io import BytesIO
from unittest.mock import patch, MagicMock

# Set path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app import app
from auth import SECRET_KEY

class TestSecurityFixes(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_secret_key_entropy(self):
        """Verify SECRET_KEY is not the hardcoded weak dev_secret_key"""
        self.assertNotEqual(SECRET_KEY, 'dev_secret_key')
        self.assertTrue(len(SECRET_KEY) >= 32)
        print(" [PASS] test_secret_key_entropy")

    def test_deprecated_login_endpoint(self):
        """Verify /api/login endpoint returns 410 Deprecated"""
        resp = self.client.post('/api/login', json={'username': 'admin', 'password': 'admin'})
        self.assertEqual(resp.status_code, 410)
        data = resp.get_json()
        self.assertIn("已廢除", data.get("message", ""))
        print(" [PASS] test_deprecated_login_endpoint")

    def test_open_redirect_protections(self):
        """Verify /api/redirect rejects malicious inputs"""
        # Test CRLF injection
        resp = self.client.get('/api/redirect?url=https://example.com%0d%0aSet-Cookie:evil=true')
        self.assertEqual(resp.status_code, 400)
        
        # Test javascript scheme
        resp = self.client.get('/api/redirect?url=javascript:alert(1)')
        self.assertEqual(resp.status_code, 400)
        
        # Test protocol-relative redirect
        resp = self.client.get('/api/redirect?url=//attacker.com')
        self.assertEqual(resp.status_code, 400)

        # Test safe external redirect
        resp = self.client.get('/api/redirect?url=https://www.example.com')
        self.assertEqual(resp.status_code, 302)
        print(" [PASS] test_open_redirect_protections")

    def test_security_headers(self):
        """Verify HTTP security headers are attached in responses"""
        resp = self.client.get('/api/login')
        self.assertEqual(resp.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(resp.headers.get('X-XSS-Protection'), '1; mode=block')
        self.assertEqual(resp.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        self.assertEqual(resp.headers.get('X-Frame-Options'), 'SAMEORIGIN')
        print(" [PASS] test_security_headers")

    def test_upload_sanitization_and_validation(self):
        """Verify file upload whitelisting and magic byte checks"""
        with app.app_context():
            from auth import generate_token
            from models import User
            mock_user = User(id=1, name="TestAdmin", email="admin@example.com", role="admin")
            token = generate_token(mock_user)
            headers = {'Authorization': f'Bearer {token}'}

            with patch.object(User.query, 'get', return_value=mock_user):
                # 1. Reject non-image extensions (.html, .svg, .php)
                resp = self.client.post('/api/upload/github', data={
                    'file': (BytesIO(b"<html>malicious</html>"), "test.html")
                }, headers=headers, content_type='multipart/form-data')
                self.assertEqual(resp.status_code, 400)
                self.assertIn("不支援", resp.get_json().get('message', ''))

                # 2. Reject fake image (extension .png, content text)
                resp = self.client.post('/api/upload/github', data={
                    'file': (BytesIO(b"Not a real png file content"), "fake.png")
                }, headers=headers, content_type='multipart/form-data')
                self.assertEqual(resp.status_code, 400)
                self.assertIn("不符", resp.get_json().get('message', ''))
                print(" [PASS] test_upload_sanitization_and_validation")

if __name__ == '__main__':
    unittest.main()

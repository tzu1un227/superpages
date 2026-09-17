import sys
import os
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from models import User
from auth import generate_token

app.config['TESTING'] = True
client = app.test_client()

with app.app_context():
    admin_user = User.query.filter_by(role='admin').first()
    admin_token = generate_token(admin_user)

print("=" * 70)
print("6. 模擬惡意使用者 (Malicious User) 滲透與邊界測試")
print("=" * 70)

# Attack 1: SQL Injection in Rule Designer Note and Content
sqli_payload = "'; DROP TABLE test_dummy; --"
resp = client.post('/api/rule-designer/rules', json={
    'bank_type': 'q_bank',
    'rule': {
        'state_in': ['*'],
        'type': 'Message',
        'content': sqli_payload,
        'msg_rpy': ['安全測試'],
        'note': f"SQLi_Test_{sqli_payload}"
    }
}, headers={'Authorization': f'Bearer {admin_token}', 'X-OA-ID': '5'})
# Parameterized queries should handle this safely without throwing 500 or SQL syntax error
sqli_safe = (resp.status_code in (200, 400))
print(f"[{'PASS' if sqli_safe else 'FAIL'}] SQL Injection 參數化防禦測試: HTTP {resp.status_code}")

# Attack 2: XSS Script tag in questionnaire title
xss_payload = "<script>alert('XSS')</script>"
resp = client.post('/api/liff-questionnaires', json={
    'title': xss_payload,
    'questions': [{'content': 'Q1', 'answer_type': 'text'}]
}, headers={'Authorization': f'Bearer {admin_token}', 'X-OA-ID': '5'})
xss_safe = (resp.status_code in (200, 400))
print(f"[{'PASS' if xss_safe else 'FAIL'}] XSS 酬載存取測試: HTTP {resp.status_code}")

# Attack 3: Unauthorized cross-tenant access (Access OA 999 where user is not authorized)
with app.app_context():
    limited_user = User(id=888, name="Limited User", email="limited@test.com", role="user", allowed_oa_configs=[5])
    limited_token = generate_token(limited_user)

import auth
orig_user_class = auth.User
class CustomMockUserQuery:
    @staticmethod
    def get(uid):
        if str(uid) == "888" or uid == 888:
            return User(id=888, name="Limited User", email="limited@test.com", role="user", allowed_oa_configs=[5])
        return orig_user_class.query.filter_by(id=uid).first()

class CustomMockUser(orig_user_class):
    query = CustomMockUserQuery

auth.User = CustomMockUser

resp = client.get('/api/tags', headers={
    'Authorization': f'Bearer {limited_token}',
    'X-OA-ID': '999' # Target forbidden OA 999
})
cross_oa_blocked = (resp.status_code == 403)
print(f"[{'PASS' if cross_oa_blocked else 'FAIL'}] 跨租戶 (Cross-OA) 越權存取攔截 (403): HTTP {resp.status_code}")

# Attack 4: Request with expired/invalid JWT signature
invalid_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.TAMPERED_SIGNATURE_HERE"
resp = client.get('/api/users', headers={
    'Authorization': f'Bearer {invalid_jwt}',
    'X-OA-ID': '5'
})
tampered_blocked = (resp.status_code == 401)
print(f"[{'PASS' if tampered_blocked else 'FAIL'}] 竄改簽章偽造 JWT 攔截 (401): HTTP {resp.status_code}")

# Attack 5: Excessive/Malformed JSON Payload in Flex Message
malformed_flex = {"Line": {"OTYPE": "FlexSendMessage", "contents": {"type": "bubble", "body": "not_an_object"}}}
resp = client.post('/api/rule-designer/rules', json={
    'bank_type': 'q_bank',
    'rule': {
        'state_in': ['*'],
        'type': 'Message',
        'content': 'flex_malform',
        'msg_rpy': [malformed_flex]
    }
}, headers={'Authorization': f'Bearer {admin_token}', 'X-OA-ID': '5'})
# validate_rule_fields should gracefully catch or handle without crash
malformed_safe = (resp.status_code in (200, 400))
print(f"[{'PASS' if malformed_safe else 'FAIL'}] 畸形 Flex JSON 結構防禦: HTTP {resp.status_code}")

print("=" * 70)
malicious_all_passed = sqli_safe and xss_safe and cross_oa_blocked and tampered_blocked and malformed_safe
print(f"惡意使用者滲透測試總結: {'🎉 全部通過 (ALL ATTACKS NEUTRALIZED)!' if malicious_all_passed else '⚠️ 部分測試未通過'}")
print("=" * 70)

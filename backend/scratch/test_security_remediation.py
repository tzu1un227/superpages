import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from models import User
from auth import generate_token

# Configure Flask test client
app.config['TESTING'] = True
client = app.test_client()

# Create tokens for testing
with app.app_context():
    admin_user = User.query.filter_by(role='admin').first()
    if not admin_user:
        # Dummy admin user object
        admin_user = User(id=1, name="Admin Test", email="admin@test.com", role="admin")
    admin_token = generate_token(admin_user)
    
    # Normal non-admin user
    normal_user = User(id=999, name="Normal User", email="user@test.com", role="user", allowed_oa_configs=[5])
    normal_token = generate_token(normal_user)

import auth
orig_user_class = auth.User

class MockUserQuery:
    @staticmethod
    def get(uid):
        if str(uid) == "999" or uid == 999:
            return User(id=999, name="Normal User", email="user@test.com", role="user", allowed_oa_configs=[5])
        with app.app_context():
            return orig_user_class.query.get(uid)

class MockUser(orig_user_class):
    query = MockUserQuery

auth.User = MockUser

endpoints_to_test = [
    # (method, path, data, name)
    ('GET', '/api/rule-designer/rules', None, '規則清單 (RuleDesigner)'),
    ('POST', '/api/rule-designer/rules', {'rule': {'type': 'Message'}}, '建立規則 (RuleDesigner)'),
    ('GET', '/api/rule-designer/follow-rules', None, '加入好友規則 (FollowRules)'),
    ('POST', '/api/rule-designer/follow-rules', {'rule': {'type': 'Follow'}}, '建立加入好友規則 (FollowRules)'),
    ('GET', '/api/questionnaire/list', None, '問卷清單 (Questionnaire)'),
    ('POST', '/api/questionnaire/build', {'note': 'test'}, '建立問卷 (Questionnaire)'),
    ('GET', '/api/liff-questionnaires', None, 'LIFF問卷清單 (LiffQuestionnaire)'),
    ('POST', '/api/liff-questionnaires', {'title': 'test'}, '建立LIFF問卷 (LiffQuestionnaire)'),
    ('GET', '/api/db/tables', None, '資料庫檢視 (DB Viewer)'),
    ('GET', '/api/db/data?table=users', None, '資料庫資料 (DB Viewer)'),
    ('GET', '/api/history/U12345678901234567890123456789012', None, '對話歷史 (History)'),
    ('GET', '/api/users', None, '客戶聊天列表 (Users)'),
    ('GET', '/api/tags', None, '標籤清單 (Tags)'),
    ('POST', '/api/trigger', {'message': 'test'}, '觸發Socket事件 (Trigger)'),
    ('GET', '/sys-debug', None, '系統除錯 (SysDebug)'),
]

print("=" * 70)
print("1. 驗證無 Token 匿名請求攔截 (401 Unauthorized 防護)")
print("=" * 70)

all_blocked = True
for method, path, data, name in endpoints_to_test:
    if method == 'GET':
        resp = client.get(path, headers={'X-OA-ID': '5'})
    else:
        resp = client.post(path, json=data or {}, headers={'X-OA-ID': '5'})
    
    is_pass = (resp.status_code == 401)
    status_icon = "✅ PASS (401)" if is_pass else f"❌ FAIL ({resp.status_code})"
    if not is_pass:
        all_blocked = False
    print(f"[{status_icon}] {method} {path} - {name}")

print("\n" + "=" * 70)
print("2. 驗證非管理員權限存取高機敏端點 (403 Forbidden 角色隔離)")
print("=" * 70)

admin_only_endpoints = [
    ('GET', '/api/db/tables', '資料庫檢視器 (DB Viewer Tables)'),
    ('GET', '/api/db/data?table=users', '資料庫檢視器 (DB Viewer Data)'),
    ('GET', '/sys-debug', '系統除錯資訊 (SysDebug)'),
]

role_isolated = True
for method, path, name in admin_only_endpoints:
    resp = client.get(path, headers={
        'Authorization': f'Bearer {normal_token}',
        'X-OA-ID': '5'
    })
    is_pass = (resp.status_code == 403)
    status_icon = "✅ PASS (403)" if is_pass else f"❌ FAIL ({resp.status_code})"
    if not is_pass:
        role_isolated = False
    print(f"[{status_icon}] {path} - {name}")

print("\n" + "=" * 70)
print("3. 驗證合法管理員帶 Token 存取 (正常放行)")
print("=" * 70)

admin_accessible = True
for method, path, data, name in endpoints_to_test[:5]:
    if method == 'GET':
        resp = client.get(path, headers={
            'Authorization': f'Bearer {admin_token}',
            'X-OA-ID': '5'
        })
    else:
        resp = client.post(path, json=data or {}, headers={
            'Authorization': f'Bearer {admin_token}',
            'X-OA-ID': '5'
        })
    # As long as it's not 401/403, auth decorator passed successfully
    auth_passed = resp.status_code not in (401, 403)
    status_icon = f"✅ PASS ({resp.status_code})" if auth_passed else f"❌ BLOCKED ({resp.status_code})"
    if not auth_passed:
        admin_accessible = False
    print(f"[{status_icon}] {method} {path} - {name}")

print("\n" + "=" * 70)
print("4. 驗證合法公開端點仍可正常存取 (不影響未登入流程)")
print("=" * 70)

public_endpoints = [
    ('GET', '/api/liff-questionnaires/public/nonexistent_survey', 'LIFF 公開問卷存取 (預期 404/200, 非 401)'),
    ('GET', '/r/nonexistent_proxy', 'LIFF 代理轉址 (預期 404/302, 非 401)'),
]

public_ok = True
for method, path, name in public_endpoints:
    resp = client.get(path, headers={'X-OA-ID': '5'})
    is_public = (resp.status_code != 401)
    status_icon = f"✅ PASS ({resp.status_code})" if is_public else f"❌ FAIL ({resp.status_code})"
    if not is_public:
        public_ok = False
    print(f"[{status_icon}] {path} - {name}")

print("\n" + "=" * 70)
print("5. 驗證 Response Header 機敏洩漏 (X-Debug-DB 移除檢查)")
print("=" * 70)

resp = client.get('/api/auth/me', headers={'Authorization': f'Bearer {admin_token}', 'X-OA-ID': '5'})
has_debug_db = 'X-Debug-DB' in resp.headers
debug_header_ok = not has_debug_db
status_icon = "✅ PASS (無 X-Debug-DB 洩漏)" if debug_header_ok else "❌ FAIL (發現 X-Debug-DB)"
print(f"[{status_icon}] Header: {dict(resp.headers)}")

print("\n" + "=" * 70)
overall_pass = all_blocked and role_isolated and admin_accessible and public_ok and debug_header_ok
print(f"總結測試結果: {'🎉 全部通過 (ALL PASSED)!' if overall_pass else '⚠️ 有項目未通過'}")
print("=" * 70)

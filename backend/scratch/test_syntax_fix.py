import sys
import ast

sys.stdout.reconfigure(encoding='utf-8')

# 模擬 dboperation 物件
class MockDBModel:
    def __init__(self, has_default=True):
        self.appname = "5013"
        self.has_default = has_default
    def getTable(self, name, filter=None):
        if self.has_default:
            return [{'ui_uuid': 'menu_uuid_12345', 'status': 'default'}]
        return []

class MockDBOp:
    def __init__(self, has_default=True):
        self.dbModel = MockDBModel(has_default)

update_called = []
def update(val):
    update_called.append(val)
    print(f"  --> update 函數被呼叫: {val}")

def pri_set(k, v): pass
class MockSys:
    def name(self, m): return "Alice"
    def picture(self, m): return "http://pic.jpg"

sys_obj = MockSys()
dboperation = MockDBOp(has_default=True)
m = None

# 語法 1: 列表推導式 for x in getTable(...)[:1]
code_sol1 = 'pri_set("name",sys_obj.name(m)),pri_set("pic",sys_obj.picture(m)),[update(f"switch_rm|{x[\'ui_uuid\']}") for x in dboperation.dbModel.getTable(\'rich_menu_metadata:\' + str(dboperation.dbModel.appname), filter=[(\'status\',\'default\')])[:1]]'

# 語法 2: lambda if res else None
code_sol2 = 'pri_set("name",sys_obj.name(m)),pri_set("pic",sys_obj.picture(m)),(lambda res: update(f"switch_rm|{res[0][\'ui_uuid\']}") if res else None)(dboperation.dbModel.getTable(\'rich_menu_metadata:\' + str(dboperation.dbModel.appname), filter=[(\'status\',\'default\')]))'

print("=== [1. 測試方案 1: List Comprehension for x in getTable(...)[:1]] ===")
print("語法 AST 驗證:", end=" ")
try:
    ast.parse(code_sol1)
    print("✅ 通過 AST 語法解析！")
except Exception as e:
    print(f"❌ 錯誤: {e}")

print("當有預設選單時執行:")
update_called.clear()
dboperation = MockDBOp(has_default=True)
exec(code_sol1)
print(f"  結果: update 呼叫紀錄 = {update_called}")

print("當沒有預設選單 (getTable 回傳 []) 時執行:")
update_called.clear()
dboperation = MockDBOp(has_default=False)
exec(code_sol1)
print(f"  結果: update 呼叫紀錄 = {update_called} (完全沒有呼叫 update！)")

print("\n=== [2. 測試方案 2: Lambda (lambda res: update if res else None)] ===")
print("語法 AST 驗證:", end=" ")
try:
    ast.parse(code_sol2)
    print("✅ 通過 AST 語法解析！")
except Exception as e:
    print(f"❌ 錯誤: {e}")

print("當有預設選單時執行:")
update_called.clear()
dboperation = MockDBOp(has_default=True)
exec(code_sol2)
print(f"  結果: update 呼叫紀錄 = {update_called}")

print("當沒有預設選單 (getTable 回傳 []) 時執行:")
update_called.clear()
dboperation = MockDBOp(has_default=False)
exec(code_sol2)
print(f"  結果: update 呼叫紀錄 = {update_called} (完全沒有呼叫 update！)")

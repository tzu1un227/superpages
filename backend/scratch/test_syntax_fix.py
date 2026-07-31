import sys
import ast

sys.stdout.reconfigure(encoding='utf-8')

safe_function_code = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m)),update(f"switch_rm|{(dboperation.dbModel.getTable(\'rich_menu_metadata:\' + str(dboperation.dbModel.appname), filter=[(\'status\',\'default\')]) or [{\'ui_uuid\': \'\'}])[0][\'ui_uuid\']}")'

print("驗證方案 A 安全備退語法:")
try:
    ast.parse(safe_function_code)
    print("  ✅ 方案 A 語法完全合法，完美通過 ast.parse！")
except SyntaxError as e:
    print(f"  ❌ 語法錯誤: {e}")

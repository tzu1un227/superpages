import sys
import ast

sys.stdout.reconfigure(encoding='utf-8')

original_error_code = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m)),update(f"switch_rm|{dboperation.dbModel.getTable(f"rich_menu_metadata:{dboperation.dbModel.appname}",filter=[(\'status\',\'default\')])[0][\'ui_uuid\']}")'

fixed_code = 'pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m)),update(f"switch_rm|{dboperation.dbModel.getTable(\'rich_menu_metadata:\' + str(dboperation.dbModel.appname), filter=[(\'status\',\'default\')])[0][\'ui_uuid\']}")'

print("1. 嘗試解析原代碼:")
try:
    ast.parse(original_error_code)
    print("  原代碼無錯誤")
except SyntaxError as e:
    print(f"  ❌ 原代碼重現相同語法錯誤: {e}")

print("\n2. 嘗試解析修正後代碼:")
try:
    ast.parse(fixed_code)
    print("  ✅ 修正後代碼解析成功！合法 Python 語法！")
except SyntaxError as e:
    print(f"  ❌ 修正後代碼仍有錯誤: {e}")


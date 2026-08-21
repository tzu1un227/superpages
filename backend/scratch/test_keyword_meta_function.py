import ast
import json
import sys
import os
import datetime

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from endpoints.rule_designer import strip_pri_set_meta, validate_python_syntax

class SysMock:
    @staticmethod
    def now(type_str=None, offset=(0,0,0)):
        t = (datetime.datetime.now() + datetime.timedelta(hours=offset[0], minutes=offset[1], seconds=offset[2]))
        return t.strftime(type_str) if type_str else int(t.timestamp())

def test_keyword_meta():
    print("=== Testing Keyword Meta with sys.now() ===")
    
    clean_note = "VIP專屬優惠"
    kw_disp = "VIP, 優惠"
    trigger_disp = f"觸發關鍵字: {kw_disp}"
    
    func_parts = [
        "update(f\"set_tag|['VIP', '已領券']\")",
        f"pri_set(\"tag_meta:VIP\", '{{\"source_type\":\"keyword\",\"source_name\":\"{clean_note}\",\"trigger_display\":\"{trigger_disp}\",\"setting_url\":\"/ruledesigner\",\"occurred_at\":\"' + sys.now('%Y-%m-%d %H:%M:%S') + '\"}}')",
        f"pri_set(\"tag_meta:已領券\", '{{\"source_type\":\"keyword\",\"source_name\":\"{clean_note}\",\"trigger_display\":\"{trigger_disp}\",\"setting_url\":\"/ruledesigner\",\"occurred_at\":\"' + sys.now('%Y-%m-%d %H:%M:%S') + '\"}}')",
        "update(\"iup|proj_123\")",
        f"pri_set(\"journey_meta:proj_123\", '{{\"source_type\":\"keyword\",\"source_name\":\"{clean_note}\",\"trigger_display\":\"{trigger_disp}\",\"setting_url\":\"/ruledesigner\",\"occurred_at\":\"' + sys.now('%Y-%m-%d %H:%M:%S') + '\"}}')",
        "update(\"switch_rm|menu_uuid_abc\")",
        f"pri_set(\"rich_menu_meta\", '{{\"source_type\":\"keyword\",\"source_name\":\"{clean_note}\",\"trigger_display\":\"{trigger_disp}\",\"setting_url\":\"/ruledesigner\",\"occurred_at\":\"' + sys.now('%Y-%m-%d %H:%M:%S') + '\"}}')"
    ]
    full_function = ",".join(func_parts)
    print(f"Generated function:\n{full_function}\n")
    
    # 2. 驗證 Python 語法
    syntax_err = validate_python_syntax(full_function, 'function')
    assert syntax_err is None, f"Syntax validation failed: {syntax_err}"
    print("[PASS] validate_python_syntax passed!")
    
    # 3. 驗證 strip_pri_set_meta
    stripped = strip_pri_set_meta(full_function)
    print(f"Stripped sensor function:\n{stripped}\n")
    expected_stripped = "update(f\"set_tag|['VIP', '已領券']\"),update(\"iup|proj_123\"),update(\"switch_rm|menu_uuid_abc\")"
    assert stripped == expected_stripped, f"Expected '{expected_stripped}', but got '{stripped}'"
    print("[PASS] strip_pri_set_meta passed!")
    
    # 4. 驗證執行並解析
    recorded = {}
    def pri_set(k, v):
        recorded[k] = v
        
    exec(full_function, {"pri_set": pri_set, "sys": SysMock, "update": lambda *args: None})
    
    val = json.loads(recorded["tag_meta:VIP"])
    print("[PASS] Executed and parsed JSON:", val)
    assert val["source_type"] == "keyword"
    assert val["occurred_at"] is not None
    print("[PASS] occurred_at:", val["occurred_at"])

    print("\nAll tests passed successfully!")

if __name__ == '__main__':
    test_keyword_meta()

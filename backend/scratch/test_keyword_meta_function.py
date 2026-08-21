import ast
import json
import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from endpoints.rule_designer import strip_pri_set_meta, validate_python_syntax

def test_keyword_meta():
    print("=== Testing Keyword Meta Function Generation and Parsing ===")
    
    # 1. 模擬前端產生的 function 字串 (包含 tag_meta, rich_menu_meta, journey_meta)
    clean_note = "VIP專屬優惠"
    kw_disp = "VIP, 優惠, 8折"
    trigger_disp = f"觸發關鍵字: {kw_disp}"
    
    tag1_json = json.dumps({
        "source_type": "keyword",
        "source_name": clean_note,
        "trigger_display": trigger_disp,
        "setting_url": "/ruledesigner"
    })
    escaped_tag1_json = tag1_json.replace('\\', '\\\\').replace("'", "\\'")
    
    tag2_json = json.dumps({
        "source_type": "keyword",
        "source_name": clean_note,
        "trigger_display": trigger_disp,
        "setting_url": "/ruledesigner"
    })
    escaped_tag2_json = tag2_json.replace('\\', '\\\\').replace("'", "\\'")

    rm_json = json.dumps({
        "source_type": "keyword",
        "source_name": clean_note,
        "trigger_display": trigger_disp,
        "setting_url": "/ruledesigner"
    })
    escaped_rm_json = rm_json.replace('\\', '\\\\').replace("'", "\\'")

    jm_json = json.dumps({
        "source_type": "keyword",
        "source_name": clean_note,
        "trigger_display": trigger_disp,
        "setting_url": "/ruledesigner"
    })
    escaped_jm_json = jm_json.replace('\\', '\\\\').replace("'", "\\'")

    func_parts = [
        "update(f\"set_tag|['VIP', '已領券']\")",
        f"pri_set(\"tag_meta:VIP\", '{escaped_tag1_json}')",
        f"pri_set(\"tag_meta:已領券\", '{escaped_tag2_json}')",
        "update(\"iup|proj_123\")",
        f"pri_set(\"journey_meta:proj_123\", '{escaped_jm_json}')",
        "update(\"switch_rm|menu_uuid_abc\")",
        f"pri_set(\"rich_menu_meta\", '{escaped_rm_json}')"
    ]
    full_function = ",".join(func_parts)
    print(f"Generated function:\n{full_function}\n")
    
    # 2. 驗證 Python 語法
    syntax_err = validate_python_syntax(full_function, 'function')
    assert syntax_err is None, f"Syntax validation failed: {syntax_err}"
    print("[PASS] validate_python_syntax passed!")
    
    # 3. 驗證 strip_pri_set_meta (用於成對 Sensor 規則)
    stripped = strip_pri_set_meta(full_function)
    print(f"Stripped sensor function:\n{stripped}\n")
    expected_stripped = "update(f\"set_tag|['VIP', '已領券']\"),update(\"iup|proj_123\"),update(\"switch_rm|menu_uuid_abc\")"
    assert stripped == expected_stripped, f"Expected '{expected_stripped}', but got '{stripped}'"
    print("[PASS] strip_pri_set_meta passed!")
    
    # 4. 驗證 JSON 反序列化與欄位相容性 (customers.py / tooltip)
    parsed_tag1 = json.loads(tag1_json)
    assert parsed_tag1["source_type"] == "keyword"
    assert parsed_tag1["source_name"] == clean_note
    assert parsed_tag1["trigger_display"] == trigger_disp
    assert parsed_tag1["setting_url"] == "/ruledesigner"
    print("[PASS] JSON deserialization and tooltip fields verified!")

    print("\nAll tests passed successfully!")

if __name__ == '__main__':
    test_keyword_meta()

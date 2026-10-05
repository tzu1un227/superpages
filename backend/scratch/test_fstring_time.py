import ast
import json
import datetime

# 模擬 sys 模組
class SysMock:
    @staticmethod
    def now(type_str=None, offset=(0,0,0)):
        t = (datetime.datetime.now() + datetime.timedelta(hours=offset[0], minutes=offset[1], seconds=offset[2]))
        return t.strftime(type_str) if type_str else int(t.timestamp())

def test():
    clean_note = "VIP專屬優惠"
    trigger_disp = "觸發關鍵字: VIP"
    
    code = f"""pri_set("tag_meta:VIP", '{{"source_type":"keyword","source_name":"{clean_note}","trigger_display":"{trigger_disp}","setting_url":"/ruledesigner","occurred_at":"' + sys.now('%Y-%m-%d %H:%M:%S') + '"}}')"""
    
    print("Generated Code:")
    print(code)
    
    ast.parse(code, mode='exec')
    print("[PASS] AST parse successful!")
    
    recorded = {}
    def pri_set(k, v):
        recorded[k] = v
        print(f"pri_set called with key={k}, value={v}")
        
    exec(code, {"pri_set": pri_set, "sys": SysMock})
    
    val_json = json.loads(recorded["tag_meta:VIP"])
    print("[PASS] Parsed JSON:", val_json)
    assert val_json["source_type"] == "keyword"
    assert val_json["source_name"] == clean_note
    assert val_json["trigger_display"] == trigger_disp
    assert val_json["setting_url"] == "/ruledesigner"
    assert val_json["occurred_at"] is not None
    print("[PASS] occurred_at:", val_json["occurred_at"])
    print("\nAll tests passed successfully!")

if __name__ == '__main__':
    test()

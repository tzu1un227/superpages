import ast
import json
import datetime

class SysMock:
    @staticmethod
    def now(type_str=None, offset=(0,0,0)):
        t = (datetime.datetime.now() + datetime.timedelta(hours=offset[0], minutes=offset[1], seconds=offset[2]))
        return t.strftime(type_str) if type_str else int(t.timestamp())

def test():
    # JS simulation
    cleanNote = "VIP優惠"
    triggerDisp = "觸發關鍵字: VIP"
    metaObj = {
        "source_type": "keyword",
        "source_name": cleanNote,
        "trigger_display": triggerDisp,
        "setting_url": "/ruledesigner"
    }
    baseJson = json.dumps(metaObj, ensure_ascii=False)
    prefix = baseJson[:-1]
    escapedPrefix = prefix.replace('\\', '\\\\').replace("'", "\\'")
    expr = f"""pri_set("tag_meta:VIP", '{escapedPrefix},"occurred_at":"' + sys.now('%Y-%m-%d %H:%M:%S') + '\"}}')"""
    
    print("Generated Python expression:")
    print(expr)
    
    ast.parse(expr, mode='exec')
    print("[PASS] AST parse successful!")
    
    recorded = {}
    def pri_set(k, v):
        recorded[k] = v
        print(f"pri_set called with key={k}, value={v}")
        
    exec(expr, {"pri_set": pri_set, "sys": SysMock})
    
    val_json = json.loads(recorded["tag_meta:VIP"])
    print("[PASS] Parsed JSON:", val_json)
    assert val_json["source_type"] == "keyword"
    assert val_json["source_name"] == cleanNote
    assert val_json["trigger_display"] == triggerDisp
    assert val_json["setting_url"] == "/ruledesigner"
    assert val_json["occurred_at"] is not None
    print("[PASS] occurred_at:", val_json["occurred_at"])

if __name__ == '__main__':
    test()

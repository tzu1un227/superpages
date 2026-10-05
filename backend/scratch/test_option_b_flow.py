import ast
import json

def test_option_b():
    # 模擬前端產生的 sys_bind payload
    # 動作：標籤 ['旅程標籤', 'VIP'], 圖文選單 'mt16zcwfg2kbwbuj1dm', 旅程 '6'
    # 按鈕文字: '查看詳情'
    
    tags_str = "['旅程標籤', 'VIP']"
    journey_str = "6"
    menu_str = "mt16zcwfg2kbwbuj1dm"
    val = "查看詳情"
    
    meta_keys = "['tag_meta:旅程標籤', 'tag_meta:VIP', 'journey_meta:6', 'rich_menu_meta']"
    meta_val_obj = {
        "source_type": "journey",
        "source_name": "測試旅程",
        "trigger_display": f"點擊: {val}",
        "setting_url": "/projects"
    }
    meta_val_str = json.dumps(meta_val_obj, ensure_ascii=False)
    
    payload = f"sys_bind|{tags_str}|{journey_str}|{menu_str}|{val}|{meta_keys}|{meta_val_str}"
    print("Generated Payload:")
    print(payload)
    print("Payload Length:", len(payload))
    assert len(payload) <= 300, f"Payload too long: {len(payload)}"
    
    # 模擬 Q_bank 執行環境
    parts = payload.split('|')
    def c_cut(idx):
        return parts[idx] if idx < len(parts) else ""
        
    q_bank_func = """
pri_push('tag', eval(c_cut(1)), nd=True) if c_cut(1) else "",
update(f"iup|{c_cut(2)}") if c_cut(2) else "",
update(f"switch_rm|{c_cut(3)}") if c_cut(3) else "",
update(c_cut(4)) if c_cut(4) else "",
[pri_set(k, c_cut(6)) for k in eval(c_cut(5))] if c_cut(5) and c_cut(5).startswith('[') else pri_set(c_cut(5), c_cut(6)) if c_cut(5) else ""
""".replace('\n', '')

    print("\nQ_bank Function:")
    print(q_bank_func)
    
    ast.parse(q_bank_func, mode='exec')
    print("[PASS] AST Parse passed!")
    
    storage = {}
    tags_list = []
    actions = []
    
    def pri_push(k, v, nd=False):
        if isinstance(v, list):
            tags_list.extend(v)
        else:
            tags_list.append(v)
        storage[k] = list(set(tags_list))
        
    def pri_set(k, v):
        storage[k] = v
        print(f"pri_set called: {k} -> {v}")
        
    env = {
        'c_cut': c_cut,
        'pri_push': pri_push,
        'pri_set': pri_set,
        'update': lambda a: actions.append(a),
        'eval': eval
    }
    
    exec(q_bank_func, env)
    
    print("\nStorage after execution:")
    for k, v in storage.items():
        print(f"  {k}: {v}")
        
    assert "tag_meta:旅程標籤" in storage
    assert "tag_meta:VIP" in storage
    assert "journey_meta:6" in storage
    assert "rich_menu_meta" in storage
    print("\n[SUCCESS] Option B verified 100% successfully!")

if __name__ == '__main__':
    test_option_b()

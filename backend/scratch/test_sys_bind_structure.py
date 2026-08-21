import ast
import json

def test_lengths():
    # 測試選項 1: 使用者提出的 6 欄
    # sys_bind|tags|journey|menu|val|tag_key|tag_info|journey_key|journey_info|menu_key|menu_info
    tags_str = "['旅程標籤']"
    journey_str = "6"
    menu_str = "mt16zcwfg2kbwbuj1dm"
    val = "查看詳情"
    
    meta_json = json.dumps({
        "source_type": "journey",
        "source_name": "測試旅程",
        "trigger_display": f"點擊: {val}",
        "setting_url": "/projects"
    }, ensure_ascii=False)
    
    # 情況 A: 單一動作 (只有標籤)
    p_a = f"sys_bind|{tags_str}|||{val}|tag_meta:旅程標籤|{meta_json}|||||"
    print("情況 A (只有標籤) 長度:", len(p_a))
    print(p_a)
    assert len(p_a) <= 300
    
    # 情況 B: 兩個動作 (標籤 + 圖文選單)
    p_b = f"sys_bind|{tags_str}||{menu_str}|{val}|tag_meta:旅程標籤|{meta_json}|||rich_menu_meta|{meta_json}"
    print("\n情況 B (標籤 + 選單，雙 JSON) 長度:", len(p_b))
    print("長度:", len(p_b))
    
    # 情況 C (最佳精簡版): 前面放 keys (tag_key, journey_key, menu_key)，最後放 1 個共用 meta_json
    # sys_bind|tags|journey|menu|val|tag_key|journey_key|menu_key|meta_json
    # c_cut(5)=tag_key, c_cut(6)=journey_key, c_cut(7)=menu_key, c_cut(8)=meta_json
    p_c = f"sys_bind|{tags_str}|{journey_str}|{menu_str}|{val}|tag_meta:旅程標籤|journey_meta:6|rich_menu_meta|{meta_json}"
    print("\n情況 C (共用 meta_json) 長度:", len(p_c))
    print(p_c)
    assert len(p_c) <= 300

    # 驗證情況 C 的 Q_bank 執行
    parts = p_c.split('|')
    def c_cut(idx):
        return parts[idx] if idx < len(parts) else ""
        
    code_c = """
pri_push('tag', eval(c_cut(1)), nd=True) if c_cut(1) else "",
update(f"iup|{c_cut(2)}") if c_cut(2) else "",
update(f"switch_rm|{c_cut(3)}") if c_cut(3) else "",
update(c_cut(4)) if c_cut(4) else "",
pri_set(c_cut(5), c_cut(8)) if c_cut(5) and c_cut(8) else "",
pri_set(c_cut(6), c_cut(8)) if c_cut(6) and c_cut(8) else "",
pri_set(c_cut(7), c_cut(8)) if c_cut(7) and c_cut(8) else ""
""".replace('\n', '')

    ast.parse(code_c, mode='exec')
    print("\n[PASS] code_c AST parse passed!")
    
    storage = {}
    env = {
        'c_cut': c_cut,
        'pri_push': lambda k, v, nd=False: storage.update({k: v}),
        'pri_set': lambda k, v: storage.update({k: v}),
        'update': lambda a: None,
        'eval': eval
    }
    exec(code_c, env)
    print("Storage result:", storage)
    assert "tag_meta:旅程標籤" in storage
    assert "journey_meta:6" in storage
    assert "rich_menu_meta" in storage
    print("[SUCCESS] All tests passed!")

if __name__ == '__main__':
    test_lengths()

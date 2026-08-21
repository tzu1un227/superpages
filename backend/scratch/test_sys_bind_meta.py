import ast
import json
import datetime

class SysMock:
    @staticmethod
    def now(type_str=None, offset=(0,0,0)):
        t = (datetime.datetime.now() + datetime.timedelta(hours=offset[0], minutes=offset[1], seconds=offset[2]))
        return t.strftime(type_str) if type_str else int(t.timestamp())

def test_sys_bind():
    # 模擬 payload
    # sys_bind|['旅程標籤', 'VIP']|6|mt16zcwfg2kbwbuj1dm|旅程圖片訊息|journey|{"project_id":4,"step_id":2,"tag":"project_4_step_2_1787210621127"}
    payload = ["sys_bind", "['旅程標籤', 'VIP']", "6", "mt16zcwfg2kbwbuj1dm", "旅程圖片訊息", "journey", '{"project_id":4,"step_id":2,"tag":"project_4_step_2_1787210621127"}']
    
    def c_cut(idx):
        return payload[idx] if idx < len(payload) else ""

    # 設計強健的 sys_bind function 語法
    # 支援：
    # 1. 貼標籤 + 寫入 tag_meta
    # 2. 加入旅程 + 寫入 journey_meta
    # 3. 切換選單 + 寫入 rich_menu_meta
    # 4. 發送文字 update
    
    code = """
pri_push('tag', eval(c_cut(1)), nd=True) if c_cut(1) else "",
update(f"iup|{c_cut(2)}") if c_cut(2) else "",
update(f"switch_rm|{c_cut(3)}") if c_cut(3) else "",
update(c_cut(4)) if c_cut(4) else "",
[pri_set(f"tag_meta:{t}", '{"source_type":"' + (c_cut(5) or 'journey') + '","source_name":"旅程訊息","trigger_display":"點擊: ' + c_cut(4) + '","setting_url":"/projects","occurred_at":"' + sys.now('%Y-%m-%d %H:%M:%S') + '"}') for t in eval(c_cut(1))] if c_cut(1) and c_cut(5) else "",
pri_set(f"journey_meta:{c_cut(2)}", '{"source_type":"' + (c_cut(5) or 'journey') + '","source_name":"旅程訊息","trigger_display":"點擊: ' + c_cut(4) + '","setting_url":"/projects","occurred_at":"' + sys.now('%Y-%m-%d %H:%M:%S') + '"}') if c_cut(2) and c_cut(5) else "",
pri_set("rich_menu_meta", '{"source_type":"' + (c_cut(5) or 'journey') + '","source_name":"旅程訊息","trigger_display":"點擊: ' + c_cut(4) + '","setting_url":"/projects","occurred_at":"' + sys.now('%Y-%m-%d %H:%M:%S') + '"}') if c_cut(3) and c_cut(5) else ""
""".replace('\n', '')

    print("Code:")
    print(code)
    
    ast.parse(code, mode='exec')
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
        print(f"pri_set: {k} -> {v}")
        
    env = {
        'c_cut': c_cut,
        'pri_push': pri_push,
        'pri_set': pri_set,
        'update': lambda a: actions.append(a),
        'sys': SysMock,
        'eval': eval
    }
    
    exec(code, env)
    print("\nRecorded storage:")
    for k, v in storage.items():
        print(f"  {k}: {v}")
        
    assert "tag_meta:旅程標籤" in storage
    assert "tag_meta:VIP" in storage
    assert "journey_meta:6" in storage
    assert "rich_menu_meta" in storage
    print("\n[SUCCESS] All metadata written successfully!")

if __name__ == '__main__':
    test_sys_bind()

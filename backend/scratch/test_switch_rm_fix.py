import ast
import json

class MockDBModel:
    appname = '5013'
    @staticmethod
    def getTable(table_name, filter=None):
        data = [
            {'id': 2, 'name': '預設選單', 'rich_menu_id': 'richmenu-d45e35ca203745729c0960af748e8e54', 'ui_uuid': 'ms8fvhj61r2a6912k14', 'permission_tags': []},
            {'id': 3, 'name': '文字選單', 'rich_menu_id': 'richmenu-bfbd90dcbdcd5d30768c4afbb5c106b3', 'ui_uuid': 'mt16tpa0vdad035tq7', 'permission_tags': ['VIP']},
            {'id': 4, 'name': '旅程選單', 'rich_menu_id': 'richmenu-1c76808513aee69287d4810cfe304992', 'ui_uuid': 'mt16zcwfg2kbwbuj1dm', 'permission_tags': []},
        ]
        if filter:
            k, v = filter[0]
            return [d for d in data if d.get(k) == v]
        return data

class MockDBOperation:
    dbModel = MockDBModel

def test_syntax():
    # 測試語法
    func_template = """(lambda res: (pri_set('rm_info', res[0]), update("set_menu") if not res[0].get('permission_tags') or (set(res[0].get('permission_tags', [])) & set(eval(pri('tag') or '[]'))) else update("fallback")) if res else "")(dboperation.dbModel.getTable(f"rich_menu_metadata:{dboperation.dbModel.appname}", filter=[('rich_menu_id' if c_cut(1).startswith('richmenu-') else 'ui_uuid', c_cut(1))]) or dboperation.dbModel.getTable(f"rich_menu_metadata:{dboperation.dbModel.appname}", filter=[('rich_menu_id', c_cut(1))]))"""
    
    ast.parse(func_template, mode='exec')
    print("[PASS] AST parse successful!")
    
    # 測試三種情況：
    # 情況 1: 傳入 rich_menu_id 'richmenu-1c76808513aee69287d4810cfe304992' (無權限限制)
    storage = {'tag': "['一般']"}
    actions = []
    env = {
        'c_cut': lambda idx: 'richmenu-1c76808513aee69287d4810cfe304992',
        'pri_set': lambda k, v: storage.update({k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)}),
        'pri': lambda k: storage.get(k, ''),
        'update': lambda a: actions.append(a),
        'dboperation': MockDBOperation,
        'set': set,
        'eval': eval
    }
    exec(func_template, env)
    print("情況 1 actions:", actions)
    assert actions == ['set_menu']
    print("[PASS] 情況 1 通過！")

    # 情況 2: 傳入 ui_uuid 'mt16tpa0vdad035tq7' (需要 VIP 標籤，用戶有 VIP)
    storage = {'tag': "['VIP', '已領券']"}
    actions = []
    env['c_cut'] = lambda idx: 'mt16tpa0vdad035tq7'
    exec(func_template, env)
    print("情況 2 (符合權限) actions:", actions)
    assert actions == ['set_menu']
    print("[PASS] 情況 2 通過！")

    # 情況 3: 傳入 ui_uuid 'mt16tpa0vdad035tq7' (需要 VIP 標籤，用戶無 VIP)
    storage = {'tag': "['普通用戶']"}
    actions = []
    env['c_cut'] = lambda idx: 'mt16tpa0vdad035tq7'
    exec(func_template, env)
    print("情況 3 (未符合權限) actions:", actions)
    assert actions == ['fallback']
    print("[PASS] 情況 3 通過！")

    # 情況 4: 傳入不存在的 uuid / richmenu id
    storage = {'tag': "['普通用戶']"}
    actions = []
    env['c_cut'] = lambda idx: 'non_existent_id'
    exec(func_template, env)
    print("情況 4 (查無選單) actions:", actions)
    assert actions == []
    print("[PASS] 情況 4 (完全不噴 IndexError) 通過！")

if __name__ == '__main__':
    test_syntax()

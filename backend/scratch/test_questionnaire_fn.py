import ast
import json

def test_build(t="問卷標籤", clean_note="測試問卷"):
    parts = []
    base_json = json.dumps({
        "source_type": "form",
        "source_name": clean_note,
        "trigger_display": "問卷完成",
        "setting_url": "/questionnaire"
    }, ensure_ascii=False)
    prefix = base_json[:-1]
    escaped_prefix = prefix.replace("\\", "\\\\").replace("'", "\\'")
    
    # Old code
    old_stmt = 'pri_set("tag_meta:' + t + '", \'' + escaped_prefix + ',"occurred_at":"\' + sys.now(\'%Y-%m-%d %H:%M:%S\') + \'}")'
    print("Old stmt string:", repr(old_stmt))
    try:
        ast.parse(old_stmt)
        print("Old stmt ast.parse: SUCCESS")
    except Exception as e:
        print("Old stmt ast.parse: FAILED ->", e)

    # New code
    new_stmt = 'pri_set("tag_meta:' + t + '", \'' + escaped_prefix + ',"occurred_at":"\' + sys.now(\'%Y-%m-%d %H:%M:%S\') + \'"}\')'
    print("\nNew stmt string:", repr(new_stmt))
    try:
        ast.parse(new_stmt)
        print("New stmt ast.parse: SUCCESS")
    except Exception as e:
        print("New stmt ast.parse: FAILED ->", e)

test_build()

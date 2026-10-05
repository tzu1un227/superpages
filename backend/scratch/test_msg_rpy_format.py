"""Quick test for format_msg_rpy_list to verify correct Line-Bot-Main msg_rpy format."""
import json
import sys
sys.path.insert(0, '.')

# Inline the function to test without importing the full app
def format_msg_rpy_list(msg_rpy_list):
    if not isinstance(msg_rpy_list, list):
        return []
    formatted = []
    for m in msg_rpy_list:
        if isinstance(m, str):
            s = m.strip()
            if s.startswith('{') or s.startswith('['):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, dict):
                        if 'Line' in parsed:
                            formatted.append(s)
                        elif 'OTYPE' in parsed:
                            wrapped = {"Line": parsed}
                            formatted.append(json.dumps(wrapped, ensure_ascii=False))
                        else:
                            formatted.append(s)
                    else:
                        formatted.append(s)
                    continue
                except (json.JSONDecodeError, TypeError):
                    pass
            if s and s != '""' and s != "''":
                text_val = s
                if len(text_val) >= 2 and text_val.startswith('"') and text_val.endswith('"'):
                    try:
                        text_val = json.loads(text_val)
                    except Exception:
                        pass
                if text_val:
                    wrapped = {"Line": {"OTYPE": "TextSendMessage", "text": text_val}}
                    formatted.append(json.dumps(wrapped, ensure_ascii=False))
            else:
                formatted.append(json.dumps({"Line": {"OTYPE": "TextSendMessage", "text": ""}}, ensure_ascii=False))
        elif isinstance(m, dict):
            if 'Line' in m:
                formatted.append(json.dumps(m, ensure_ascii=False))
            elif 'OTYPE' in m:
                wrapped = {"Line": m}
                formatted.append(json.dumps(wrapped, ensure_ascii=False))
            elif 'type' in m and m.get('type') in ('text', 'image', 'flex'):
                type_map = {'text': 'TextSendMessage', 'image': 'ImageSendMessage', 'flex': 'FlexSendMessage'}
                converted = {k: v for k, v in m.items() if k != 'type'}
                converted['OTYPE'] = type_map.get(m['type'], 'TextSendMessage')
                wrapped = {"Line": converted}
                formatted.append(json.dumps(wrapped, ensure_ascii=False))
            else:
                formatted.append(json.dumps(m, ensure_ascii=False))
        else:
            formatted.append(json.dumps(m, ensure_ascii=False))
    return formatted


# Test cases
print("=" * 60)
print("Test 1: Plain text string (from WelcomeMessage)")
result = format_msg_rpy_list(["感謝您加入我們的官方帳號！"])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed, f"Missing 'Line' key: {r}"
    assert parsed['Line']['OTYPE'] == 'TextSendMessage'
    assert parsed['Line']['text'] == '感謝您加入我們的官方帳號！'
print(f"  ✅ {result[0]}")

print("\nTest 2: Dict with OTYPE but no Line wrapper (from RuleDesigner)")
result = format_msg_rpy_list([{"OTYPE": "TextSendMessage", "text": "你好"}])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
    assert parsed['Line']['OTYPE'] == 'TextSendMessage'
    assert parsed['Line']['text'] == '你好'
print(f"  ✅ {result[0]}")

print("\nTest 3: Already correct format (from questionnaire.py)")
correct = {"Line": {"OTYPE": "TextSendMessage", "text": "Q1. 你的名字是？"}}
result = format_msg_rpy_list([correct])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
    assert parsed['Line']['text'] == 'Q1. 你的名字是？'
print(f"  ✅ {result[0]}")

print("\nTest 4: Already correct format as JSON string")
correct_str = json.dumps(correct, ensure_ascii=False)
result = format_msg_rpy_list([correct_str])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
print(f"  ✅ {result[0]}")

print("\nTest 5: Image message dict without Line wrapper")
result = format_msg_rpy_list([{"OTYPE": "ImageSendMessage", "original_content_url": "https://example.com/img.jpg", "preview_image_url": "https://example.com/img.jpg"}])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
    assert parsed['Line']['OTYPE'] == 'ImageSendMessage'
print(f"  ✅ {result[0]}")

print("\nTest 6: Flex message dict without Line wrapper")
result = format_msg_rpy_list([{"OTYPE": "FlexSendMessage", "alt_text": "歡迎", "contents": {"type": "bubble", "body": {"type": "box", "layout": "vertical", "contents": [{"type": "text", "text": "hi"}]}}}])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
    assert parsed['Line']['OTYPE'] == 'FlexSendMessage'
print(f"  ✅ {result[0][:80]}...")

print("\nTest 7: JSON string with OTYPE but no Line wrapper")
result = format_msg_rpy_list(['{"OTYPE": "TextSendMessage", "text": "test"}'])
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed
    assert parsed['Line']['text'] == 'test'
print(f"  ✅ {result[0]}")

print("\nTest 8: Mixed list (WelcomeMessage scenario)")
result = format_msg_rpy_list([
    "歡迎加入！",
    {"OTYPE": "ImageSendMessage", "original_content_url": "https://img.jpg", "preview_image_url": "https://img.jpg"},
    {"Line": {"OTYPE": "TextSendMessage", "text": "已正確"}}
])
assert len(result) == 3
for r in result:
    parsed = json.loads(r)
    assert 'Line' in parsed, f"Missing 'Line' key: {r}"
print(f"  ✅ All 3 items correctly wrapped")
for i, r in enumerate(result):
    print(f"     [{i}] {r[:80]}{'...' if len(r) > 80 else ''}")

print("\n" + "=" * 60)
print("All tests passed! ✅")

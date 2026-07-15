import codecs
new_arch = '## [2026-07-15] 雙軌法則機制 Bug 修復 (Issue #31)\n- **修正 (backend/endpoints/rule_designer.py)**: 修正建立、刪除法則時，無法正確同步 Sensor 法則的問題 (原本誤用 category 與 msg_in 欄位，現已修正為 type 與 content 欄位)。\n- **修正 (frontend/src/components/FlexMessageEditor.jsx)**: 修正當按鈕未綁定標籤時產生的 sys_bind 格式會導致 Webhook 解析發生 SyntaxError 的問題，將空的標籤字串改為 []。\n\n'
try:
    with codecs.open('CHANGELOG.md', 'r', 'utf-8') as f: content = f.read()
    with codecs.open('CHANGELOG.md', 'w', 'utf-8') as f: f.write(new_arch + content)
except Exception:
    with codecs.open('CHANGELOG.md', 'r', 'big5', errors='ignore') as f: content = f.read()
    with codecs.open('CHANGELOG.md', 'w', 'big5', errors='ignore') as f: f.write(new_arch + content)

path = r"c:\Users\70640\Documents\GitHub\Line-Bot-Main\doc\CHANGELOG.md"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

target = "- **[sensors/sys.py] & [sensors/cronjobs.py]**: 修復 sys.bmcast 與 cronjobs 處理 QA 訊息時的資料格式解析相容性，自動安全解開外層平台包裹鍵 (如 'Line') 並支援 JSON 字串解析，徹底排除 KeyError: 'Line' 錯誤。"

replacement = """- **[sensors/sys.py] & [sensors/cronjobs.py]**: 修復 sys.bmcast 與 cronjobs 處理 QA 訊息時的資料格式解析相容性，自動安全解開外層平台包裹鍵 (如 'Line') 並支援 JSON 字串解析，徹底排除 KeyError: 'Line' 錯誤。
- **[api/Line.py]**: 修復 `multicast_message` 在傳入空受眾名單 (`id_list=[]`) 時因 `if id_list:` 為 False 而誤觸 `else: self.API.broadcast(m)` 全員推播的重大漏洞，加入 `if id_list is not None: if not id_list: return` 安全防護。
- **[sensors/dboperation.py]**: 將 `g_opr` 的 `use_db` 預設值修正為 `True`，確保群發推播在執行時皆從資料庫 (getTable) 查詢最新完整名單，避免因記憶體快取未載入而查得 0 人。"""

text = text.replace(target, replacement)
with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("SUCCESS")

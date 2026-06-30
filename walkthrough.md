

## 2026-06-30 UI 微調與防呆修正
- **圖文選單**:
  - 發佈遮罩直接採用 LoadingSpinner 元件的 fullScreen 屬性，修復提示文字偏向右側的排版錯誤。
- **自動旅程**:
  - 當旅程名稱重複時，不再跳出「請先補齊必填欄位」錯誤，而是精準呈現「此旅程名稱已存在，請使用不同名稱」的對應原因。
- **關鍵字回覆**:
  - 優化觸發關鍵字解析與過濾，對空 tag 進行 filter(Boolean) 處理，解決一開始出現空白 tag 且無法被刪除的 BUG。
- **訊息中心**:
  - 聊天室標籤刪除按鈕 style 中添加 minWidth: 'auto'，防止其繼承 index.css 全域 button 的 min-width 導致刪除叉叉兩側有極大空格的排版問題。


## 2026-06-30 精準事件驅動頭貼同步與自癒功能
- **UserAvatar 元件**:
  - 新增了位於 [UserAvatar.jsx](file:///c:/Users/70640/Documents/GitHub/superpages/frontend/src/components/UserAvatar.jsx) 的通用頭貼元件。
  - 元件在加載圖片成功前，統一顯示灰色 User Icon 佔位符。
  - 若原有圖片載入失敗（觸發 onError，通常是因頭像 URL 過期或更換頭像 403），會主動向後端發起非同步請求以自癒頭像網址。
- **後端 refresh-profile API**:
  - 新增 POST /api/customers/<user_id>/refresh-profile 路由。
  - 當前端要求刷新時，實時調用 LINE Profile API，並以 UPDATE ... ON CONFLICT INSERT 的安全方式同步更新資料庫中 Private_var 的 pic 與 
ame 值。
  - 前後端已在客戶中心 (CustomerCenter.jsx) 與訊息中心聊天室 (MessageCenter.jsx) 中全面替換並啟用。


## 2026-06-30 針對封鎖用戶 API 404 進行溫和回退處理
- **API 自癒修復**:
  - 修正了 /refresh-profile API 對 LINE API 404 Not Found (封鎖官方帳號或非好友) 的處理機制。
  - 後端改為回傳 200 並附帶空屬性值，前端將直接平穩回退至顯示灰色 User 佔位符，並完全防阻瀏覽器 Console 出現紅字 404 的報錯警報。


## 2026-06-30 修正 LINE Profile API Endpoint URL
- **後端 customers.py**:
  - 修正了 `refresh_customer_profile` 函式中調用 LINE API 的網址，從錯誤的 `https://api.line.me/v2/bot/user/{user_id}/profile` 改為官方正確的 `https://api.line.me/v2/bot/profile/{user_id}`。
  - 此修正解決了原本因為 API 網址寫錯而導致所有用戶頭像刷新時一律回傳 404，從而使已換頭貼的用戶依然停留在灰色 User 狀態的問題。


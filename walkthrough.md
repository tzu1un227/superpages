

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

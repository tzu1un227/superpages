## Superpages 系統架構概要

- **前端 (Frontend)**: 
  - 基於 React 構建，透過 React Router 處理頁面路由。
  - App.jsx: 包含 MainLayout 負責渲染全域側邊導覽列（支援縮放與 OA 區塊層級的獨立收合/展開）與路由配置。
  - Projects.jsx: 處理「自動旅程」排程與參與用戶狀態顯示 (包含已中斷等邏輯)，並包含 RichMessageModal 提供豐富訊息編輯功能（影片支援預覽圖，音訊隱藏長度輸入）。
  - Broadcast.jsx: 處理「群發訊息」功能，包含各式 Rich Message 的編輯、上傳與預覽。
  - MessageCenter.jsx: 處理客服對話視窗、歷史訊息載入與捲軸加載邏輯。
  - RuleDesigner.jsx: 處理「關鍵字回覆」與「法則表設計」，支援簡易與工程模式（簡易模式下刪除規則後會自動返回列表）。
- **後端 (Backend)**: 
  - 基於 Flask 構建，提供各種 RESTful API 端點 ( pp.py)。
  - get_users_list & get_project_users API: 負責撈取用戶資訊與最新互動狀態，透過 history 的 Follow/Unfollow 標記來計算 is_following。
- **資料庫 (Database)**: 
  - PostgreSQL，透過 psycopg2 操作。使用 user_project_status, history, cron_table 等核心資料表紀錄排程與事件。

- **客戶中心模組 (Customer Center Module)**:
  - Frontend (`CustomerCenter.jsx`): 右側欄整合用戶詳細資訊 (標籤管理、自動旅程狀態、專屬圖文選單)。透過 API 讀取特定用戶的 details。
  - Backend (`customers.py`): 提供 `/api/customers/<user_id>/details` 與 `DELETE /api/customers/<user_id>/richmenu`。使用 LINE API 即時查詢與解除專屬圖文選單。

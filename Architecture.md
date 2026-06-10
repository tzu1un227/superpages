## Superpages 系統架構概要

- **前端 (Frontend)**: 
  - 基於 React 構建，透過 React Router 處理頁面路由。
  - Projects.jsx: 處理「自動旅程」排程與參與用戶狀態顯示 (包含已中斷等邏輯)。
  - Broadcast.jsx: 處理「群發訊息」功能，包含各式 Rich Message 的編輯、上傳與預覽。
  - MessageCenter.jsx: 處理客服對話視窗、歷史訊息載入與捲軸加載邏輯。
- **後端 (Backend)**: 
  - 基於 Flask 構建，提供各種 RESTful API 端點 (pp.py)。
  - get_users_list & get_project_users API: 負責撈取用戶資訊與最新互動狀態，透過 history 的 Follow/Unfollow 標記來計算 is_following。
- **資料庫 (Database)**: 
  - PostgreSQL，透過 psycopg2 操作。使用 user_project_status, history, cron_table 等核心資料表紀錄排程與事件。



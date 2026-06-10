## [2026-06-10] superpages dev-and-deploy-docker Update
- **自動旅程 (Projects.jsx)**: 
  - 進階訊息編輯器新增語音訊息自動偵測長度功能，並鎖定手動輸入框。
  - 進階訊息編輯器新增圖片、影片上傳後即時預覽功能。
  - 新增對 unfollow 用戶的狀態顯示，將 ctive 且已封鎖的用戶標記為【已中斷】，保留當前進度。
- **群發訊息 (Broadcast.jsx)**:
  - 影片訊息新增按鈕上傳與即時預覽功能。
  - 切換訊息類別時，若有已輸入內容會跳出警告訊息。
- **訊息中心 (MessageCenter.jsx)**:
  - 解決左側邊欄滾動到底部時的閃爍/抖動 UI Bug。
  - 用戶觸發 unfollow 事件時自動關閉訊息輸入欄並顯示「目前用戶已封鎖」；重新 follow 後自動解封。
- **後端 (backend/app.py)**:
  - 更新 get_users_list 與 get_project_users API 以回傳 is_following 狀態，供前端判斷用戶追蹤情況。



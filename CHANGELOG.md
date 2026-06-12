## [2026-06-12] superpages UI/UX Improvements
- **前端全域 (App.jsx)**:
  - 左側邊欄的 OA（官方帳號）區塊新增獨立的收合與展開按鈕功能。
- **自動旅程 (Projects.jsx)**:
  - 影片訊息編輯時，影片預覽區現在會正確吃入 `preview_image_url` 顯示為封面圖 (poster)。
  - 聲音訊息編輯時，隱藏多餘的 duration 長度顯示，改為純自動讀取後端資料，不干擾視覺。
- **關鍵字回覆 (RuleDesigner.jsx)**:
  - 修正簡易模式下刪除關鍵字後卡在空白編輯頁面的問題，現在刪除後會自動跳轉回關鍵字列表。
  - 在簡易模式的「建立關鍵字回覆」、「刪除關鍵字」以及進階訊息編輯的「確認並儲存」按鈕上，新增載入旋轉動畫 (Loading Spinner) 與按鈕禁用狀態，優化使用者體驗。

## [2026-06-10] superpages dev-and-deploy-docker Update
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



### 2026-06-10
- **Feature**: 透過問卷管理建立問卷時，\
ote\ 欄位會自動後綴 \- 工程用法則\。
- **Feature**: 問卷管理前端畫面 (\Questionnaire.jsx\) 隱藏 \工程用法則\ 字尾，不顯示給使用者。
- **Feature**: \RuleDesigner.jsx\ 的簡易模式利用關鍵字過濾隱藏帶有 \工程用法則\ 的問卷。

### 2026-06-10 Customer Center Updates
- **Feature**: 客戶中心右側欄新增標籤管理 (新增/刪除)、自動旅程狀態顯示與中斷、圖文選單狀態顯示與解除綁定。
- **Feature**: 後端 customers.py 新增 /api/customers/<user_id>/details 與 DELETE /api/customers/<user_id>/richmenu。

- **BugFix**: 修正客戶中心右側欄讀取自動旅程狀態時的 SQL 欄位名稱錯誤 (projects 表的 project_id 與 project_name)。

- **Feature**: 系統最外層的主導覽列新增縮放按鈕，可將側邊欄收合以放大主工作區。

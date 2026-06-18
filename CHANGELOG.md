## [2026-06-18] 關鍵字回覆圖片訊息網址顯示
- **前端 (frontend/src/pages/RuleDesigner.jsx)**:
  - 移除先前的「查看圖片」按鈕。
  - 調整介面為「上傳後直接在輸入框顯示圖片網址」，使其與自動旅程的排程介面保持一致，提供更直覺的操作體驗。

## [2026-06-17] 前端媒體上傳容量限制與驗證
- **前端 (frontend/src/pages/Projects.jsx, Broadcast.jsx, RuleDesigner.jsx, RichMenu.jsx, LiffQuestionnaire.jsx, FlexMessageEditor.jsx)**:
  - 實作前端上傳檔案時的容量限制與錯誤提示，避免大檔案上傳至 GitHub 造成 Repo 肥大或因 GitHub API 限制而失敗。
  - 各類型媒體限制：圖片 (5 MB)、影片 (50 MB)、音檔 (30 MB)、預覽圖 (1 MB)、圖文選單圖片 (1 MB)、問卷背景圖 (1 MB)。

## [2026-06-17] 圖文選單同步與 Link 按鈕分離
- **前端 (frontend/src/pages/RichMenu.jsx)**:
  - 於設計圖文選單時，將原先的「同步至 LINE」按鈕拆分為「同步至 LINE」與「同步並 Link」兩個選項，以控制發佈時是否要立即觸發與標籤或全體用戶的綁定。

## [2026-06-17] 圖文選單標籤與自動綁定更新
- **後端 (backend/endpoints/richmenu.py, backend/endpoints/customers.py)**:
  - 實作基於標籤的自動化圖文選單綁定機制 (`bulk_check_and_update_rich_menu`)。
  - 新增 `/api/customers/count-by-tags` 用於計算符合標籤的用戶人數。
  - 從使用者設定變更 (新增/刪除標籤) 或發佈圖文選單時，自動於背景觸發使用者的圖文選單切換。
- **前端 (frontend/src/pages/RichMenu.jsx)**:
  - 移除舊版「權限控管」手動設定介面。
  - 編輯圖文選單新增「公開」與「限定 (指定標籤)」開放狀態。
  - 支援動態複選標籤，並即時預覽預計套用人數。
  - 列表介面更新標籤與發佈狀態顯示。

## [2026-06-16] Flex 動態綁定機制更新
- **前端 (frontend/src/components/FlexMessageEditor.jsx)**:
  - 支援在圖片與按鈕行為中設定「加入自動旅程」與「切換圖文選單」。
  - 重構 payload 生成與解析機制，採用 `sys_bind|{tag}|{journey}|{menu}|{displayText}` 統一格式。

## [2026-06-16] 問卷名稱錯誤訊息更新
- **後端 (backend/endpoints/questionnaire.py)**:
  - 建立問卷時若名稱重複，錯誤提示訊息隱藏原先顯示的問卷名稱字串。

## [2026-06-12] superpages UI/UX Improvements
- **前端全域 (App.jsx)**:
  - 左側邊欄的 OA（官方帳號）區塊新增獨立的收合與展開按鈕功能。
- **自動旅程 (Projects.jsx)**:
  - 影片訊息編輯時，影片預覽區現在會正確吃入 `preview_image_url` 顯示為封面圖 (poster)。
  - 聲音訊息編輯時，隱藏多餘的 duration 長度顯示，改為純自動讀取後端資料，不干擾視覺。
- **關鍵字回覆 (RuleDesigner.jsx)**:
  - 修正簡易模式下刪除關鍵字後卡在空白編輯頁面的問題，現在刪除後會自動跳轉回關鍵字列表。
  - 在簡易模式的「建立關鍵字回覆」、「刪除關鍵字」以及進階訊息編輯的「確認並儲存」按鈕上，新增載入旋轉動畫 (Loading Spinner) 與按鈕禁用狀態，優化使用者體驗。
- **群發訊息 (Broadcast.jsx)**:
  - 修正影片訊息的預覽顯示，現在影片未播放時會正確顯示所設定的預覽圖 (poster)。

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

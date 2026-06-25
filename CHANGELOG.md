## [2026-06-24] 優化串接流程分頁文案
- **前端 (frontend/src/pages/AdminPage.jsx)**:
  - 潤飾「串接流程」分頁中的五個步驟文案，使其更為專業且容易理解。

## [2026-06-24] 管理員後台新增串接流程分頁
- **前端 (frontend/src/pages/AdminPage.jsx)**:
  - 將「帳號管理」標題更改為「管理員後台」。
  - 新增「串接流程」分頁，列出新帳號的五個串接步驟。

## [2026-06-24] 修復資料庫日誌噪音
- **後端 (backend/app.py)**:
  - 修復了 `project_stats_processor` 會在每次檢查時嘗試建立 `Global_var` 資料表，導致 PostgreSQL 頻繁產生 `relation already exists` (42P07) 的 log 噪音問題。改為先檢查資料表是否存在，若不存在才執行 `CREATE TABLE`。
- **後端 (backend/endpoints/questionnaire.py, backend/endpoints/liff_questionnaire.py)**:
  - 統一在執行 `CREATE TABLE IF NOT EXISTS` 之前加上 `SET LOCAL client_min_messages = warning;`，以抑制問卷相關資料表建立時產生的 PostgreSQL 噪音 (`relation already exists, skipping`)。

## [2026-06-23] 圖文選單發布策略與權限設定統一
- **前端 (frontend/src/pages/RichMenu.jsx)**:
  - 移除了原有的「發佈對象 (公開/限定)」與「發佈 Modal」，改為整合的「發布策略」選擇區塊。
  - 草稿資料現在會儲存 `publishStrategy`，包含 `hidden` (純上架不顯示)、`default` (立即設為全體預設) 與 `restricted` (指定綁定對象後套用)。
  - 右側設定面板重構為五個獨立區塊：基本設定、切換權限設定、發布策略、排程設定、區塊設定，使介面更清晰一致。
  - 「區塊設定」由原本的圖片預覽旁移至右側設定欄的最下方。
  - 更新「切換權限設定」文案為「誰可切換於此圖文」，簡化使用體驗。
  - 發佈至 LINE 時，系統會直接依據各草稿設定的策略進行作業，若為 `default` 則會自動呼叫後端 API 設定為全域預設圖文選單。

## [2026-06-23] 客戶中心介面優化與即時同步實作
- **前端 (frontend/src/pages/CustomerCenter.jsx)**:
  - 移除了客戶中心列表的「編輯」按鈕，將編輯功能整合至右側詳細資訊側邊欄中。
  - 在側邊欄的「名稱」、「手機」、「電子信箱」旁加入編輯圖示，點擊可直接「內聯編輯 (Inline Edit)」，並可儲存或取消。
  - 優化側邊欄關閉邏輯：點擊中間主畫面內容區時，側邊欄會自動關閉，而點擊左側導航或側邊欄內部則不受影響。
  - 強化即時同步機制：在側邊欄內編輯名稱/電話/Email、新增/刪除標籤、退出自動旅程、解除圖文選單後，畫面上的客戶列表資料均會即時同步更新，無需重新整理頁面。

## [2026-06-23] 關鍵字回覆觸發動作擴展與 Bug 修復
- **前端 (frontend/src/pages/RuleDesigner.jsx)**:
  - 擴展關鍵字回覆建立時的「觸發後動作」，支援多項動作同時執行 (以逗號分隔)。
  - 「自動上標」由原生下拉選單改為搭配 `<TagInput singleSelect={true}>` 元件，提供選定後框框標註的視覺回饋並維持單選限制。
  - 關鍵字回覆儲存時會自動於 note 欄位加上「- 關鍵字回覆」後綴，並在畫面上自動隱藏，確保簡易模式下只顯示有關鍵字回覆註記的法則，而工程模式依然顯示全部。
  - 新增「加入自動旅程」與「連結圖文選單」的下拉選單選項，選取後會自動產生對應的 `update("iup|<id>")` 與 `update("switch_rm|<uuid>")`。
  - 修正關鍵字回覆介面中，編輯包含 `Line` 屬性的現有回覆訊息時，圖片上傳後 URL 未正確更新到對應層級的問題。
  - 修復關鍵字回覆編輯器中，圖片上傳完成後網址輸入框未即時更新為最新 URL 的問題 (解決 React state closure 問題)。
  - 修正「連結圖文選單」選項的值，確保正確代入 `ui_uuid` 而非 `rich_menu_id` 以符合後端預期。
    - 將獲取圖文選單的 API 端點由 `/richmenu/` (僅回傳 LINE 原始資料) 修正為 `/richmenu/metadata` (回傳包含 `ui_uuid` 的資料庫詮釋資料)，徹底解決因找不到 `ui_uuid` 而被預設寫入選單名稱的 Bug。
- **前端 (frontend/src/pages/Questionnaire.jsx)**:
  - 問卷管理儲存時會自動於 note 欄位加上「- 問卷管理」後綴以利辨識，並且問卷列表頁面現在會嚴格過濾，只顯示擁有「- 問卷管理」註記的法則，畫面上同樣自動隱藏此後綴字串。
- **後端 (backend/app.py)**:
  - 修正 `/api/statistics` 中查詢 `get_events_count_by_category_and_tag` 時傳入的分類名稱大小寫問題，確保能正確撈取到對應的圖表數據。
- **後端 (backend/endpoints/questionnaire.py)**:
  - 修正讀取現有問卷時，因解析 `update("set_tag|標籤")` 格式導致標籤結尾多出 `")` 的 Bug，確保前端標籤顯示正常。
  - 優化問卷管理的字數/格式限制錯誤提示，原先將「錯誤提示」與「重新提問」合併在同一個文字氣泡中，現在改為拆分成兩個獨立的對話泡泡依序發送。
  - 建立問卷時若成功，回傳的成功訊息不再包含問卷名稱與 ID，只顯示「問卷已成功建立」，以保持介面簡潔。
  - 移除了過去建立問卷時強制將 `note` 後綴加上「- 工程用法則」的邏輯，現在統一使用「- 問卷管理」做分類。
  - 修正了問卷開啟「回顧答案」功能時，回顧訊息的標題會一併顯示「- 問卷管理」等註記後綴的問題，確保呈現給使用者的標題名稱乾淨無冗字。
  - 修正問卷管理中的「自動上標」機制，寫入資料庫的函式格式從 `pri_push('tag', '標籤')` 改為 `update("set_tag|標籤")` 以符合最新規格。
- **後端 (backend/migrate_rule_notes.py)**:
  - 撰寫並執行一次性的資料庫遷移腳本，將舊有且未帶有系統後綴的法則自動補上「- 關鍵字回覆」後綴，確保舊資料不會在簡易模式中消失。

## [2026-06-22] 圖文選單介面與切換選項優化
- **前端 (frontend/src/pages/RichMenu.jsx)**:
  - 圖文選單編輯頁面中，將「區塊設定」區塊移至編輯圖的右側 (使用橫向排版)，讓使用者在設定區塊時不需捲動畫面即可同時看到圖形與設定欄位。
  - 圖文選單的區塊切換動作下拉式選單中，自動過濾掉「自己」(目前正在編輯的圖文選單)，避免設定成自己跳自己的無限迴圈。

## [2026-06-18] 綜合數據修復
- **後端 (backend/app.py)**:
  - 修正 /api/statistics 的好友數與有效好友數計算，確保僅統計符合 U 開頭且長度為 33 的有效 LINE User ID。
- **資料庫 (RDS & 5014)**:
  - 同步更新 get_events_count_by_category_and_tag Function，新增相同的 LINE User ID 過濾條件以保證前端圖表資料精確無誤。

## [2026-06-18] 檔案上傳大小限制放寬與錯誤訊息改善
- **後端 (backend/endpoints/upload.py)**:
  - 將 GitHub 檔案上傳大小限制由 1MB 提高至 5MB。
  - 當檔案超過 5MB 時回傳明確的 JSON 錯誤訊息及 413 狀態碼。
- **前端 (frontend/src/pages/*.jsx)**:
  - 改善檔案上傳發生錯誤時的處理邏輯，當捕獲到 413 (Payload Too Large) 狀態碼時，統一提示：「檔案過大，不可超過 5MB」。
  - 避免前端僅顯示通用的「上傳失敗」而導致使用者無法理解原因。

## [2026-06-18] 圖文選單切換權限與 Fallback 訊息設定
- **資料庫 (backend/endpoints/broadcast.py)**:
  - `rich_menu_metadata` 資料表擴增 `permission_tags`、`fallback_message`、`alias_id` 欄位以支援權限控管機制。
- **後端 (backend/endpoints/richmenu.py)**:
  - 儲存與讀取圖文選單資料時支援上述三個新欄位。
- **前端 (frontend/src/pages/RichMenu.jsx)**:
  - 建立圖文選單時新增「切換權限設定」區塊，支援複選「切換權限標籤」與設定「無權限提示訊息 (Fallback)」。
  - 取消手動輸入「選單別名」，改為在儲存草稿或發佈時由系統自動產生。
  - 區塊點擊動作若為「切換選單」，改為下拉選單選擇已發佈的圖文選單。
  - 發佈至 LINE 時，自動將「切換選單」動作轉換為 Postback 格式，夾帶預計切換的 `menuID`、該選單的 `permission_tags` (Python list 字串格式) 以及 `fallback_message`，供後端進行權限檢核。
  - 圖文選單列表與查看畫面中新增權限標籤與 Fallback 訊息的預覽。

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

## [2026-06-22] 群組化圖文選單與自動連結
### Added
- 資料表結構新增 ui_uuid 與 group_id 欄位以支援多選單連動與群組化。
- 前端實作圖文選單群組 UI，支援以頁籤切換不同草稿與狀態。
- 實作發佈前選擇「預設圖文選單」的功能。
- 實作全域資料表結構更新。

 # #   [ U n r e l e a s e d ]   -   R i c h   M e n u   U I / U X   U p d a t e s 
 -   * * M o d i f i e d * *    a c k e n d / e n d p o i n t s / c u s t o m e r s . p y :   U p d a t e d   / c o u n t - b y - t a g s   e n d p o i n t   t o   r e t u r n   	 o t a l C o u n t   a l o n g   w i t h   m a t c h e d   u s e r   c o u n t . 
 -   * * M o d i f i e d * *    r o n t e n d / s r c / p a g e s / R i c h M e n u . j s x :   A d d e d   U I   e l e m e n t s   t o   d i s p l a y   t h e   p e r c e n t a g e   o f   t o t a l   f o l l o w e r s   f o r   t a r g e t e d   a n d   d e f a u l t   r i c h   m e n u s .   A d d e d   a   d e d i c a t e d   L i n k M o d a l   c o m p o n e n t   f o r   s e l e c t i n g   t h e   l i n k a g e   s t r a t e g y   f r o m   t h e   L i s t   V i e w .   A d d e d   i n l i n e   t a r g e t   m e n u   p r e v i e w   f u n c t i o n a l i t y   f o r   
 i c h m e n u s w i t c h   a r e a   a c t i o n s . 
 
 
 # #   [ U n r e l e a s e d ]   -   R i c h   M e n u   M i n o r   F i x e s 
 -   * * M o d i f i e d * *    r o n t e n d / s r c / p a g e s / R i c h M e n u . j s x :   A d d e d   d r a f t   d e l e t i o n   b u t t o n   i n s i d e   g r o u p   t a b s ,   i m p l e m e n t e d   c r e a t e _ a n d _ s w i t c h   q u i c k   a c t i o n   i n   a r e a   s w i t c h   d r o p d o w n ,   s t a c k e d   s c h e d u l e   t i m e   i n p u t s   v e r t i c a l l y ,   a n d   f i x e d   t a r g e t   m e n u   i m a g e   p r e v i e w   b y   f e t c h i n g   f r o m   b l o b   c a c h e . 
 
 
- **Bug Fix (2026-06-23)**: 修復了在圖文選單「發布策略」中，當切換到「指定綁定對象後套用」且 targetTags 為空時導致畫面崩潰且無法顯示可用標籤的問題。

*   **customers API**: 修復圖文選單 /count-by-tags 統計邏輯不一致問題，改為與綜合數據相同的「真實活躍好友 (未封鎖)」作為總人數計算基準。

## 2026-06-25
- [功能] 新增 WebSocket 連線時的 SIGNATURE_KEY 簽章驗證，以相容 Line-Bot-Main 的新版安全規範。
## [2026-06-25] - Syslog Integration
### Added
- ��X NAS Syslog�A����O�����n����ݾާ@�欰 (�s�W�Ϥ���B�ק�M�׳]�w�B�פJ�Ƶ{��)�C
- �s�W utils/syslogger.py �P ReconnectingSSLSysLogHandler�A�N Syslog �߰e��m�I��������A�T�O�s�u��í�� API �����v�T�C
- �䴩�����ܼ� NAS_SYSLOG_APPNAME �Ϥ� Docker �P Heroku ���p���ҡC


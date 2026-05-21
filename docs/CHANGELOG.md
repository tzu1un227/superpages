# CHANGELOG

### [2026-05-21] 修正 LIFF ID 錯誤導致的初始化失敗與手機秒退問題
- **修正 LIFF 問卷 ID**：將 `superpages` 前端的 `LiffQuestionnaire.jsx` 以及獨立部署的 `liff_questionnaire/index.html` 中誤植的舊 LIFF ID `2009851813-AgTeSa4r` 更換為正確的專屬 LIFF ID `2009851813-eNpc9OUb`。這解決了因 LIFF ID 不符合導致 Endpoint URL 驗證失敗，進而造成手機版 LINE 秒退與電腦版卡在載入畫面的問題。（圖文選單與 Flex 編輯器用於跳轉追蹤的功能則保留使用原 LIFF ID）。
- **強化網址參數解析機制**：在 `liff_questionnaire/index.html` 中加入對 `liff.state` 機制的支援。當 LINE 客戶端重導向時將查詢參數隱藏於 `liff.state` 內時，能正確解析並合併出 `oaId` 與 `surveyId`，徹底解決進入問卷卻顯示「網址缺少必要參數」的問題。

### [2026-05-21] LIFF 問卷UI通知提醒、移地開發與手機即時關閉問題排修
- **前端問卷管理（LiffQuestionnaire.jsx）**：加入載入問卷詳情與儲存修改時的 Toast 狀態通知提醒，優化使用者操作體驗；同時在儲存修改或建立問卷期間，限制「取消編輯」按鈕為 disabled，防範競態衝突與非預期重設。
- **自動帶入 API Origin 參數**：於前端生成複製連結時，自動解析當前 Axios `api.defaults.baseURL` 或瀏覽器 location 連線 Origin，自動附加 `backend` 參數至 LIFF URL，讓 LINE 客戶端能動態知道要連線的後端 API 位置。
- **LIFF 填寫頁優化（liff_questionnaire/index.html）**：
  - 將 `liff.init()` 初始化步驟優先提到最前端，防範 LINE App 內置瀏覽器因過早執行耗時的後端 API 請求而逾時自動關閉（秒退問題）。
  - 重構初始化與錯誤捕捉機制，若於 LINE 內載入或初始化失敗，向上拋出錯誤並顯示防禦性的紅叉錯誤提示畫面，引導使用者排查，提升 App 健全度。
  - 預設後端位址 `DEFAULT_BACKEND_ORIGIN` 調整為正式環境 `https://irl-svr.ee.yzu.edu.tw:5017`。
- **清理舊檔案與移地開發**：
  - 物理刪除原先位於 `superpages/liff-questionnaire/` 的舊前端填寫端代碼，完全遷移至獨立的儲存庫目錄 `c:\Users\70640\Documents\GitHub\liff_questionnaire\` 下，避免重複與版本混亂。

### [2026-05-21] LIFF 問卷功能欄位調整與時間 Bug 修復
- **修正開始與結束時間 Bug**：修復 `_parse_time` 解析 datetime-local 時長度計算錯誤（因 `len(fmt)` 回傳格式代碼字元數而非格式化字串的字元數）導致時間解析為 None 的 Bug。改用動態長度擷取解析。
- **移除 `liff_id` 欄位**：廢除並移除 `liff_questionnaires` 中無實質作用的 `liff_id` 欄位。更新後端 DDL、建立自動執行 `DROP COLUMN` 遷移、移除 `create_survey` 與 `_survey_payload` 中該欄位存取，並更新填答頁面 [index.html](file:///c:/Users/70640/Documents/GitHub/superpages/liff-questionnaire/index.html) 直接使用預設 ID。
- **建立平面化作答 VIEW**：在資料庫建立檢視表 `v_liff_questionnaire_results:{app_id}`，整合問卷、問題、作答主檔與明細，方便管理員以單一平面表查閱「誰在何時填了什麼答案」，不破壞既有的一對多正規化結構。

### [2026-05-21] LIFF 問卷管理功能優化與編輯功能實作
- **LIFF問卷編輯功能 (Edit Questionnaire)**：
  - **後端**：實作 `PUT /api/liff-questionnaires/<survey_key>` API。防禦性比對前端傳入的問題結構，使用 `UPDATE` / `INSERT` / `DELETE` 混合同步機制，確保既有问题的資料庫遞增 `id` 不變，保護歷史作答紀錄的完整性與可讀性。
  - **前端**：在問卷列表卡片上新增「編輯問卷」按鈕；點擊時透過 API 載入問卷題目詳情並填入左側表單，點擊「儲存修改」呼叫後端 API 儲存，並支援「取消編輯」重設表單。此外，在切換 OA 時，自動清空並重設編輯狀態。
  - **按鈕防護**：當點擊「儲存修改」或「建立」且處於儲存中（`saving` 狀態）時，限制「取消編輯」按鈕變為停用（disabled），防止競態衝突。
- **TagInput 選項易讀性優化 (Tag Select UI)**：
  - 修復 `TagInput.jsx` 中可用標籤下拉選單文字顏色未明確指定，在某些環境下呈黑色而與灰色背景（`#333`）衝突、導致看不清的問題，明確指定為白色 (`#fff`)。
- **隱藏 appName 與 surveyId (Remove helper texts & keys)**：
  - 移除建立 LIFF 問卷表單時顯示的 `appName: XXX` 輔助說明文字，並移除問卷卡片上的 `surveyId: XXX` 系統識別文字，提升介面整潔度與安全性。
- **提供 GitHub Pages 單頁前端填寫端 (GitHub Pages Frontend)**：
  - 新增 `liff-questionnaire/index.html` 靜態填寫網頁。支援 LINE LIFF 初始化、身分驗證、動態題目載入與前端輸入校正，並提供環境 API 位址設定齒輪，方便直接發布於 GitHub Pages 託管。
- **修復複製連結失敗導致建立失敗 (Clipboard Copy Fix)**：
  - 將複製連結機制以 try-catch 包裹，並加入傳統 input textarea fallback `document.execCommand` 雙防衛機制，防止 clipboard writeText 因無焦點或非 HTTPS 權限拒絕而導致整個問卷建立 Promise 中斷與顯示錯誤。

## [2026-05-21] 多專案與 OA 切換狀態殘留 Bug 修復
- **(重要) 修復跨專案預載快取污染 Bug**：修復 `api.js` 中 Axios request 攔截器會無條件以當前網址路徑覆蓋手動帶入之 `X-OA-ID` 標頭的問題。這導致背景預載其他專案的資料時發送了錯誤的 `X-OA-ID` 標頭，進而污染了快取資料造成專案間資料搞混。現已改為僅在未手動設定時才從網域匹配注入。
- **客戶中心狀態重設**：修復 `CustomerCenter.jsx` 在切換 OA (`oaId` 變更) 時，未能即時更新或清空舊客戶資料與分頁狀態，現已加入依賴項監聽並清空 state 的安全重載邏輯。
- **問卷管理狀態重設**：修復 `Questionnaire.jsx` 切換 OA 時殘留上一個專案問卷的 Bug，現已於監聽 `oaId` 的 effect 中先清空問卷群組、列表，並重設表單狀態。
- **訊息中心可用標籤切換**：修復 `MessageCenter.jsx` 從不同 OA 切換時，標籤篩選清單仍殘留上個 OA 的標籤的 Bug。現已在 `location.pathname` 變更的 effect 中先清空可用標籤並重新 fetch。

## [2026-05-21] 資料庫連線外洩安全修復
- **後端連線外洩全面修復**：系統性修復 `app.py` 中約 20 個 Route Handler 的危險連線模式，統一改為 `conn = None` 初始化 + `try/except/finally`，確保 Exception 發生時連線 100% 歸還至 `ThreadedConnectionPool`。
- **修復雙重連線 Bug**：修復 `delete_project`、`delete_schedule` 重複呼叫 `get_db_connection()` 導致第一條連線永久洩漏，改為複用同一條連線。
- **修復 `import_project_schedules` 連線覆蓋 Bug**：函數中段再次賦值 `conn = get_db_connection()` 會洩漏前一條連線，改為整個函數共用同一條連線並統一在 `finally` 歸還。
- **修復 `customers.py` 初始化順序**：多個函數在 `try` 外部取連線，`cur` 未定義時 `finally` 失敗跳過 `conn.close()`，全部改用 `if cur:` / `if conn:` 防衛式 close。
- **測試驗證**：新增 `backend/test_conn_leak.py` 測試腳本，覆蓋正常使用、Exception 發生、Pool 耗盡保護等 5 項場景，全數通過。

## [2026-05-21] 全域載入動畫與資料庫連線池優化
- **前端全域載入動畫與預載優化**：新增 `GlobalLoading` 元件，登入後自動背景預載所有 OA 頁面資料。
- **後端資料庫連線池優化**：升級至 `psycopg2.pool.ThreadedConnectionPool`，`maxconn=10`。
- **(Hotfix) 修復預載快取與標籤切換問題**：修復 `api.js` 快取清空問題與 `MessageCenter.jsx` 標籤篩選未隨 OA 切換的問題。

## [2026-05-20] 變更主資料庫連線 URL
- **更新 RDS_URL 連線設定**：
  - 更新後端 `app.py`、`db_utils.py`、`endpoints/broadcast.py` 與 `insert_test_data.py` 中的主資料庫連線字串 (`RDS_URL`)，改為新提供的 Heroku PostgreSQL 資料庫。
  - **修復 SQLAlchemy 連線協定相容性**：將 `RDS_URL` 的連線協定頭由 `postgres://` 修正為 `postgresql://`。解決 SQLAlchemy 1.4+ 拋出 `NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:postgres` 的啟動崩潰錯誤。

## [2026-05-20] 圖文選單 metadata 多租戶遷移與定時排程 Bug 修復
- **多租戶資料表遷移 (`rich_menu_metadata:{appname}`)**：
  - 將原有 SQLAlchemy 靜態資料表 `rich_menu_metadata` 拆分為多租戶動態命名的原生 SQL 表格 `rich_menu_metadata:{appname}`，與系統中其他業務表（如 `projects:{appname}`）命名規範一致。
  - 在 `endpoints/broadcast.py` 的 `ensure_rds_tables(app_name)` 中加入自動建立 `rich_menu_metadata:{appname}` 的 SQL 定義，系統首次存取時即自動完成建表。
  - 於 `models.py` 中將 `RichMenuMetadata` SQLAlchemy Model 整體註解，停止使用單一靜態資料表。
- **`richmenu.py` API 全面重構**：
  - 新增 `get_t(base)` 函數，負責解析 `g.current_app_name` 並返回帶有 `appname` 後綴的雙引號包裹資料表名稱，同時觸發 `ensure_rds_tables` 自動建表。
  - 將 `GET/POST /metadata` 與 `DELETE /metadata/<id>` 三個端點，從 SQLAlchemy ORM 全面改寫為基於 `psycopg2` 的原生 SQL 查詢，讀寫目標改為各 App 專屬的後綴資料表。
  - 修正 `parse_local_naive` 時區解析 Bug：舊版本使用 `.replace('Z', '')` 粗暴裁切時區，導致 UTC 時間被當成台灣時間存入，造成 8 小時時差。新版本正確將 UTC 時間轉換為台灣時間（UTC+8）後再以 naive datetime 存入，根本解決排程時間偏差問題。
- **`app.py` 背景排程任務 `rich_menu_scheduler_processor` 重構**：
  - 舊版：遍歷所有 `RichMenuMetadata` 紀錄，對過期選單發送全域 `DELETE` 指令，導致「選單 A 過期解除」的同時錯誤清除「選單 B 正在活動中」的預設選單（競態衝突 Bug）。
  - 新版：以 **OAConfig 為單位**逐一處理，對每個 App 執行以下邏輯：
    1. 查詢 `rich_menu_metadata:{appname}` 取得所有 published 且有時間設定的選單。
    2. 找出「應生效」的唯一選單（`start_time <= now_tw < end_time`），若有多個符合則取最近啟動的（`start_time` 最大者）。
    3. 從 LINE API 取得目前實際的預設選單 ID。
    4. **防禦性比對**：有應生效選單但 LINE 預設 ID 不符 → 呼叫 POST 設定；無應生效選單且 LINE 預設 ID 屬於本系統管理的已知選單 → 才呼叫 DELETE 卸載，防止誤刪外部選單。

## [2026-05-20] 客戶中心編輯客戶基本資料功能
- **後端新增客戶編輯 API**：在 `backend/endpoints/customers.py` 中新增 `PUT /api/customers/<user_id>` 路由，可接收 `name`、`phone`、`email`，並利用安全 upsert 機制更新到 `Private_var:{app_id}` 中。
- **前端實作編輯按鈕與小視窗**：
  - 將客戶列表操作欄位中的三個點更多選項按鈕替換為「編輯」按鈕。
  - 新增編輯 Modal 狀態，點擊「編輯」後彈出小視窗，填入該客戶目前的資料。
  - 提供名稱、手機、電子信箱的編輯輸入框，以及「儲存」與「取消」操作，並在儲存成功後自動更新列表、提示成功訊息。

## [2026-05-19] 系統登入體驗優化
- **登入等待動畫與防護**：在 `Login.jsx` 中新增了 `isLoggingIn` 狀態與 `CircularProgress` 載入動畫。當使用者點擊 Google 登入並進入驗證流程時，會隱藏登入按鈕並顯示「登入中，請稍候...」的提示動畫，防止使用者因畫面未即時跳轉而重複點擊造成非預期行為。
- **介面繁體中文在地化**：將登入頁面的英文提示文字（如 "Login", "Sign in with your Google account" 等）全面翻譯並更新為繁體中文，以符合整體系統語系。

## [2026-05-18] Flex 編輯器與圖文選單修正
- **圖文選單雙快取載入優化**：為了解決各圖文選單圖片自 LINE 官方伺服器下載極其緩慢的問題，實作了前端與後端的「雙記憶體快取（Double Memory Caching）」機制：
  - **前端快取**：在 `RichMenu.jsx` 模組內建立全域 `frontendImageCache`。一旦圖片下載成功即轉換為永續 Blob URL 並予以儲存，在使用者切換視圖、搜尋或重裝組件時**瞬間載入 (0ms 延遲)**，完全不重複向後端發送 HTTP 請求。
  - **後端快取**：在 `endpoints/richmenu.py` 內建立全域 `_IMAGE_CACHE` 記憶體字典。當第一次向 LINE 伺服器成功獲取圖片位元組時，將內容與 mimetype 快取至記憶體，後續請求直接由快取回傳，使載入耗時由數秒縮短至數毫秒，並能同步於刪除選單時自動清理快取。
- **Flex 編輯器競態與回溯修復**：解決 Flex 編輯器在上傳圖片時，若使用者同時進行其他輸入（如打字），會在圖片上傳完成並產生 URL 後回溯（Rollback）並清空先前打字與上傳網址的競態問題。透過引入 `lastSavedJsonRef` 快取本機最後儲存狀態，完美阻斷父元件非同步狀態回流所觸發的錯誤本機重設。
- **圖片上傳體驗視覺化與防護**：於圖片上傳時引入 `isUploading` 狀態與微型旋轉動畫（Spinner），並禁用網址欄位與上傳按鈕，防止使用者在上傳期間進行重複點擊或輸入，確保系統狀態一致性。
- **Flex 編輯器標籤同步修正**：修正在群發訊息使用 Flex 編輯器時，標註已有標籤在儲存後重新開啟時消失的問題（修正 `extractTags` 與 `cleanPayload` 處理 LIFF URLs 編碼的邏輯）。
- **Flex 編輯器圖片預覽**：修正圖片預覽失敗問題，將佔位圖片更換為提供 `.png` 副檔名且無混和內容阻擋的 `dummyimage.com`。
- **圖文選單載入優化**：新增頁面全域載入動畫 (`LoadingSpinner`)，避免載入時畫面卡頓。
- **圖文選單反應優化**：調整 `handleEditMenu` 的非同步處理邏輯，點擊「查看」後可瞬間切換視圖，不再被圖片下載阻塞。
- **圖文選單崩潰修復**：修復點擊「新增選單」時，因未清空先前選擇之區塊 (`selectedAreaIndex`) 導致的網頁崩潰。
- **圖文選單觸碰範圍設定**：為圖文選單編輯頁面補齊 X 座標、Y 座標、寬度與高度的直接輸入框，方便精確設定觸碰範圍。
- **網站標題更新**：將 `index.html` 中的 `<title>` 從 `frontend` 更改為 `superpages`。
- **圖文選單載入動畫優化**：將原本覆蓋整個螢幕的載入動畫縮小範圍至選單列表區域，讓使用者在資料載入時仍可操作頂部導覽列與帳號切換。
- **圖文選單區塊拖拉功能**：新增拖曳與縮放支援，使用者現在可以直接在編輯區塊上拖拉移動位置，或透過右下角的控制點拖拉調整寬高，無需僅能透過輸入框修改。
- **圖文選單連結標籤支援**：在圖文選單的「開啟連結(URI)」動作中加入標籤選擇功能。在同步至 LINE API 時，系統會自動擷取 OA 設定的 App Name 並將網址轉換為附帶標籤的 LIFF 跳轉連結 (`https://liff.line.me/...`)，實現圖文選單點擊追蹤。
- **關鍵字回覆 (法則表) 介面全面翻新**：將工程導向的「法則表設計」全面重新設計為面向行銷與營運人員的 CRM 風格「關鍵字回覆」功能。引入兩層式資訊架構 (列表瀏覽與單頁編輯)，隱藏底層技術名詞 (如任務 ID、Q_bank、規則語法等)，並將簡易模式簡化為僅限管理核心觸發規則，大幅降低使用者操作門檻。
- **群發訊息預覽優化**：修改群發訊息列表中的「訊息內容預覽」區塊，為防止過長的文字訊息破壞版面結構，現在僅會統一顯示訊息類型 (例如：文字訊息、圖片訊息、圖文訊息)。
- **群發訊息讀取與新增效能大幅提升**：
  - **資料庫索引優化**：在後端多專案資料庫的 `history:{app_id}` 上建立 `(user_id, category, timestamp DESC)` 與 `(user_id, timestamp DESC)` 索引；在 `Private_var:{app_id}` 上建立 `(name)` 與 `(user_id, name)` 索引；在 `QA_bank:{app_id}` 上建立 `(tag)` 索引。這將原本 O(N * H) 複雜度的「篩選活躍好友與即時/排程廣播受眾」之核心查詢耗時，從十幾秒瞬間縮短至毫秒級，解決了廣播列表與新增群發儲存過慢的效能瓶頸。
  - **移除冗餘資料庫連線**：重構 `/api/broadcast/` (GET) 廣播列表狀態核對 (Status Reconciliation) 程式，移除過程中未使用但高度耗時的 `conn_oa` 輔助資料庫連線建立動作，顯著縮短了廣播列表的 API 回傳時間。
  - **群發發送非同步與狀態即時回饋優化**：重構前端發送群發訊息的狀態轉換與頁面跳轉邏輯。
    1. 當使用者點擊「儲存並發送」後，立即將其狀態存為 `sending` (發送中)，使其即便在背景執行中也能立刻在列表被看到。
    2. 發送指令 `/execute` 改為非同步背景執行，且**徹底移除全螢幕半透明遮罩 (Overlay) 覆蓋層**，點擊後頁面會**秒跳轉**回群發列表，給予使用者最輕量、流暢的體驗。
    3. 無論最後是「立即發送」、「確認預約排程」還是「中途儲存草稿」，系統皆會**自動跳轉回群發訊息列表，並重設分頁至「全部廣播 (All)」分頁**，確保新發起或新增到一半的任務 100% 瞬間呈現在清單中。
    4. **按鈕內嵌微型載入動畫 (Button Micro-Interactions)**：為所有「儲存草稿」與「發送/排程」按鈕內嵌微型 `CircularProgress` 旋轉載入動畫，在點擊後按鈕會變為「儲存中...」/「處理中...」並顯示旋轉特效，提供精緻的進度回饋，徹底避免使用者誤以為當機。
    5. **無感智慧即時輪詢 (Zero-Resource Live Polling)**：在前端加入「發送中」狀態偵測。**僅當**列表中存在狀態為「發送中...」的任務時，才會啟用每 3 秒一次的極輕量後端狀態輪詢，一旦狀態全部變為「已發送」，輪詢會**自動完全關閉**。這配合了 `fetchIdRef` 請求競態守衛，保障了完全即時且無多餘開銷的狀態更新，徹底解決資料庫已改但網頁很久才變的問題。
    6. 群發卡片狀態標籤本地化改為繁體中文（顯示：已發送、發送中...、已排程、草稿），提供極致順暢且完全免等待的 CRM 行銷體驗。

## [2026-05-18] 修正登入需要兩次的非同步路由轉向問題
- **移除清理**:
  - 移除不再使用的 `web-dashboard` 資料夾 (原先用作登入系統的參考)。
- **前端狀態與路由邏輯修正 (Authentication Flow Fix)**:
  - 修正 `AuthContext.jsx` 中 `fetchMyOAs` 未被 `await` 的非同步問題。這解決了使用者成功透過 Google 登入後，因應用程式尚未取得專案 (OA) 列表，而在跳轉到 Dashboard 時又被 `App.jsx` 錯誤導向回 `/login` 的問題。
  - 修正 `App.jsx` 的路由邏輯：當已登入 (`isAuthenticated=true`) 但專案列表為空時，不再將使用者重新導向回登入頁面造成無限迴圈，而是顯示「沒有可用的專案或權限，請聯繫管理員。」的提示畫面。

## [2026-05-12] 資料庫連線穩定性與效能優化
- **資料庫連線池 (Connection Pooling) 優化**:
  - 實作集中式 ThreadedConnectionPool 管理，大幅降低資料庫開啟與關閉連線的開銷。
  - 限制單一平台 (OA) 最大連線數為 10，總 RDS 連線數由 50 調降至 20，避免超過 AWS RDS 實體限制。
  - 移除「連線失敗後改用直接連線」的危險機制，改為拋出友善錯誤，防止資料庫雪崩。
- **RDS 表格檢查快取機制**:
  - 實作 `_ENSURED_TABLES` 全域快取，避免每個 API 請求重複查詢 `information_schema.tables`。
- **資料庫穩定性與連線管理**:
  - 建立 `backend/db_utils.py` 集中管理資料庫連線池，解決模組間的循環引用 (Circular Import) 問題。
  - 全面移除各 Blueprint 中的私有 `get_db_connection` 實作，統一使用連線池管理。
  - 強制所有資料庫操作進入 `try...finally` 區塊，確保連線在任何情況下（包括例外發生時）都能正確歸還至池中，杜絕連線外洩 (Connection Leak)。
  - 設定 RDS 連線池上限為 2，各租戶 (OA) 連線池上限為 2，並縮減 SQLAlchemy 池大小。此調整係針對 Heroku Postgres 20 個連線的硬體限制進行優化，以確保與其他 14 個共享專案和平共存，防止 Superpages 佔用過多資源導致系統崩潰。
- **使用者體驗優化**:
  - 將技術性的「資料庫連線過多」或「Pool is full」報錯訊息更改為更通俗的「系統繁忙，請稍後再試」，提升非技術人員的閱讀體驗。
- **功能移除**:
  - 移除「抽獎管理」頁面與相關功能，包含前端 `PrizeStatus.jsx` 頁面、路由設定及後端自動初始化資料。

## [2026-05-08] 自動旅程排程優化與 UX 提升
- **排程間隔支援年與月**:
  - 在新增或編輯自動旅程排程時，間隔時間設定新增「年」與「月」輸入項（以 1 年 = 365 天, 1 月 = 30 天計算），提供更長期的推播規劃能力。
- **編輯排程 UX 優化**:
  - 在編輯自動旅程排程時，按下確認後會顯示「儲存中...」載入狀態，並鎖定操作按鈕以防止重複提交。
- **預覽日期顯示優化**:
  - 自動旅程預覽中的預計發送時間現在包含「年份」顯示，方便查看長期排程。

## [2026-05-08] Standardizing Flex Redirect Architecture
- **Flex Message Editor Refactor**:
  - Implemented dynamic `app_name` and `oaId` injection for all generated outbound links.
  - Standardized LIFF-based redirection for links with tag assignment.
  - Unified all redirection logic to route through the centralized `/api/redirect` endpoint.
  - Removed legacy `<%m.user_id%>` placeholders to leverage LIFF-native userId retrieval.

## [2026-04-30]
### Added
- **法則表任務化儀表板**: 為「法則表設計」的簡易模式實作全新的任務卡片 UI，支援日期區間、每日時段與標籤自動化設定。
- **圖文選單 LIFF 標籤追蹤**: 支援在圖文選單的連結動作中直接設定標籤，系統自動生成 LIFF 代理連結。

### Changed
- **圖文選單介面優化**: 移除 Postback 動作類型，並將「跳轉網頁」更名為「開啟連結」以符合使用者習慣。
- **法則表簡易模式重構**: 將原本的表格視圖改為卡片式任務管理，提升非技術人員的編輯效率。

## [2026-01-29]

### Changed - UI/UX Improvements
- **專案與排程管理 (Project & Schedule Management)**:
    - **導覽優化**: 點擊專案列表中的專案名稱可直接跳轉至排程頁面並自動過濾該專案。
    - **排程列表**: 新增排程總數統計顯示。
    - **輸入介面調整**: 
        - 修正並加大「間隔時間」輸入框寬度，確保數值清晰可見（包含新增與編輯模式）。
        - 修正「分鐘」無法調整的問題。
        - 加大「儲存/取消」按鈕寬度以利點擊。
    - **視覺簡化**: 
        - 隱藏表格中的 Database ID 欄位。
        - 隱藏 Rich Message 的 `QA|` 前綴標籤，並移除編輯器中的技術用語 (`QA_bank`)。
    - **Bug Fix**: 
        - 修正「新增排程」時，間隔時間欄位因寬度不足導致無法正常顯示與輸入的問題。
        - 修正專案名稱可為空的錯誤，新增必填驗證。
        - 修正新增排程時，直接輸入的文字訊息未能正確傳遞至進階編輯器的問題。
        - **訊息格式統一**: 在「新增/編輯排程」時，若直接輸入純文字訊息，系統會於儲存時自動將其轉換為 Rich Message (QA Bank 項目)，並產生對應標籤 (`QA|cron_{即時ID}`)，確保訊息格式的一致性。

## [2026-01-27]

### Changed
- **排程設定 (Schedule Settings)**:
    - **UI 改良**: 在新增與編輯排程時，「間隔時間」欄位由原本的單一輸入框改為「天」、「時」、「分」三個獨立的整數輸入框。
    - **顯示優化**: 排程列表中的間隔時間顯示格式改為 "X天 Y小時 Z分"。
    - 此變更保持後端資料格式 (Total Hours) 不變，僅在前端進行轉換，確保與舊有資料的相容性。

## [2026-01-23]

### Changed
- **專案與排程管理 (Projects)**:
    - **狀態邏輯更新**: 專案狀態細分為 編輯中、已排程、進行中、已暫停、已完成、已終止，並由後端依據時間與啟用狀態自動計算。
    - **新增錨點設定 (Anchor Setting)**: 支援「立即觸發」與「每週特定時間 (如週六 18:00)」觸發。
    - **新增休眠時間 (Dormancy Time)**: 可設定每日不發送訊息的時段 (如 23:00~08:00)。
    - **資料庫變更**: `projects` 資料表新增 `anchor_config` 與 `dormancy_config` 欄位 (JSONB)。

## [2026-01-21]

### Added
- **Google 登入與權限管理**:
    - 後端整合 `Google Sign-In` 與 `JWT` 驗證。
    - 後端導入 `SQLAlchemy` 並建立 `User`, `Page`, `OAConfig` 模型 (使用 SQLite `meta_data.db` 儲存)。
    - 新增 `/api/admin` 相關接口，用於管理用戶權限與 OA 設定。
- **前端新功能**:
    - 新增 `Login.jsx`: 支援 Google 登入。
    - 新增 `AdminPage.jsx`: 提供管理員專用的後台介面，可設定用戶權限與連結 OA。
    - 新增 `AuthContext`: 全局登入狀態與權限控管。
    - 路由保護: 導入 `ProtectedRoute` 與 `AdminRoute` 確保頁面存取安全。

## [2026-01-07]

### Added
- 建立 `docs` 資料夾並將 `ARCHITECTURE.md` 移入。
- 建立 `CHANGELOG.md` 用於紀錄專案變更。
- **專案參與用戶**:
    - 後端新增 `/api/projects/<id>/users` 接口，從 `cron_table` 取得參與用戶。
    - 前端 `Projects.jsx` 新增「參與用戶」分頁，可查看各專案的使用者。
    - 新增「手動加入用戶」按鈕，觸發 `iup|{project_id}` 指令。
- **定時觸發事件**:
    - 資料庫新增 `scheduled_events` 資料表（支援 `interval_hours` 與 `last_executed_at`）。
    - 後端實作背景執行緒，根據設定之「隔多久觸發一次 (小時)」自動計算並執行。
    - 前端新增「定時觸發」頁面，支援設定間隔時間與查看最後執行紀錄。
- **獎品查詢頁面**:
    - 後端新增 `/api/tickets` 接口，從 `ticket_table` 取得獎品中獎狀況。
    - 前端新增 `PrizeStatus.jsx` 頁面，顯示獎品與中獎者 ID。
    - 提供遊戲控制按鈕（啟動、抽大獎、關閉、捐出、新增），並整合 Socket.io 觸發指令。

### Documentation
- 重整文件架構。

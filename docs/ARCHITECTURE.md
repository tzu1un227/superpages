# Superpages 系統架構文件

## 1. 系統總覽 (System Overview)
Superpages 是一個全端 (Full-stack) 網頁應用程式，專門用於管理自動化排程、推播訊息以及監控系統狀態。
前端採用 React，後端使用 Flask (Python)，並整合 PostgreSQL 資料庫與 Socket.IO 以實現即時通訊功能。

## 2. 核心技術與框架
- **前端 (Frontend)**
  - **核心框架**: React
  - **路由管理**: React Router
  - **狀態管理**: React Context (`AuthContext`) 與元件內部狀態 (Local State)
  - **UI 元件**: 客製化 CSS 樣式元件，並使用 `lucide-react` 提供圖示支援。
- **後端 (Backend)**
  - **核心框架**: Flask (Python)
  - **資料庫 ORM**: SQLAlchemy (主要處理 User, Page 等中繼資料)，業務邏輯資料則直接使用 `psycopg2` 操作。
  - **身分驗證**: Google OAuth 結合 JWT (JSON Web Token)。
  - **即時通訊**: Flask-SocketIO (以 Client 模式觸發外部機器人)。
  - **背景任務**: 使用 Python 的 `threading` 執行定時排程檢查 (`cron_scheduler_processor`)。

## 3. 資料庫設計 (Key Database Schema)
主要使用 PostgreSQL 儲存業務與設定資料：
- **`projects`**: 儲存自動化專案定義 (如：開始/結束時間、啟用狀態、配置等)。
- **`project_schedules`**: 定義專案內的不同階段 (Steps) 與對應發送的訊息設定。
- **`cron_table`**: 紀錄每個參與專案的使用者當前狀態 (如：進行到的 `step_id`、下次執行的 `scheduled_at` 及狀態)。
- **`qa_bank`**: 儲存複雜結構的訊息 (例如：Flex Message, 圖片等)，並透過 `QA|` 前綴標籤供系統引用。
- **`users`**: 系統管理員及已授權的使用者清單。
- **`OAConfig`**: 系統管理的多個不同官方帳號 (Official Accounts) 配置參數。

## 4. 核心系統模組
### 4.1 自動化排程引擎 (Scheduled Event Management)
排程機制完全由 `projects` 與 `cron_table` 驅動，取代了舊有的 `scheduled_events` 表格：
1. **背景輪詢 (Polling)**：背景 Daemon 執行緒每 10 秒喚醒一次。
2. **篩選任務 (Selection)**：查詢 `cron_table` 中狀態為 `active` 且 `scheduled_at` 早於或等於當前時間的紀錄。
3. **觸發發送 (Trigger)**：從 `project_schedules` 提取訊息內容，並透過 Socket.IO 發送事件給目標用戶.
4. **推進階段 (Advancement)**：計算下一次執行的時間 (`interval_hours`)，並更新 `cron_table`。若無下一階段，則依據 `is_recurring` 設定將狀態改為完成 (`completed`) 或重新循環。

### 4.2 圖文選單管理 (Rich Menu Management)
- 透過視覺化編輯器進行圖文選單的創建與修改。
- 支援多種動作：`message`, `uri`, `postback`, `richmenuswitch`。
- **LIFF 標籤追蹤**：支援在「開啟連結」動作中設定標籤，系統會自動生成 LIFF 代理連結 (Proxy URL)，在跳轉前先透過 WebSocket 標記用戶，以利後續客群分析。
- **多租戶 metadata 資料表與 ui_uuid 整合**：圖文選單的排程中繼資料 (Metadata) 以 `rich_menu_metadata:{appname}` 命名，與系統其他業務表格命名規範一致。存取由 `endpoints/richmenu.py` 的 `get_t()` 函數動態解析。系統統一使用持久的 `ui_uuid` 作為圖文選單之關聯與切換依據（例如在 Flex 訊息按鈕與關鍵字回覆規則中），避免 LINE 端重置選單導致 `richMenuId` 變更而失效。後端 API 會自動在圖文選單列表中動態對照並注入 `ui_uuid`。
- **預設選單動態對照機制**：解決資料庫中狀態可能因排程切換或手動取消而與 LINE 伺服器不同步的問題，前端不再單純依賴 metadata 中的 `'default'` 狀態，而是直接將選單 ID 與 LINE 當前實際生效的預設選單 ID 集合進行比對，從而精確顯示「預設」徽章。
- **定時排程同步引擎（`rich_menu_scheduler_processor`）**：背景任務每 60 秒執行一次，以 OAConfig 為單位，對每個 App 執行「最佳有效選單計算」—在同一時間點找出唯一應生效的選單，與 LINE 伺服器的實際預設選單 ID 進行比對後，才做出最小化的 Link/Unlink 動作，避免競態衝突。
- **雙記憶體快取加速 (Double Memory Caching)**：
  - **前端快取**：於 `RichMenu.jsx` 使用模組全域級別的 `frontendImageCache` 對下載的 Blob Object URL 進行永續儲存。大幅減少不必要的重複 API 查詢與瀏覽器記憶體解碼，切換視圖及渲染速度達到 0ms 的響應效率。
  - **後端快取**：於 `endpoints/richmenu.py` 引入全域 `_IMAGE_CACHE` 記憶體字典。當用戶端向 Flask 請求 LINE 圖片資源時，後端不再每次請求都經由慢速的國際網路向日本 LINE API 發起下載，而是直接由記憶體快取以微秒級速度回傳，並在進行選單刪除時精確同步清除快取，保證資料的一致性。

### 4.3 訊息與廣播中心 (Broadcast & Message Center)
- **訊息廣播**：支援針對所有用戶、特定標籤或特定 ID 名單發送訊息，支援最多 5 個 Bubble (支援文字、圖片、影片、Flex)。
- **訊息預覽**：後端會自動從 `QA_bank` 中提取並解析訊息摘要，前端亦內建 `JourneyPreview` 提供 Flex Message 即時預覽。
- **防禦性渲染 (Defensive Rendering)**：使用 Error Boundary 及可選串連 (Optional Chaining) 確保含有不完整舊資料時，UI 依然能穩定運行。
- **編輯器雙向綁定競態阻斷 (Bidirectional State Guard)**：
  - 在 `FlexMessageEditor` 的 auto-save 機制中引入 `lastSavedJso## 6. LIFF 問卷管理與防禦性更新機制
- **LIFF問卷防禦性編輯 (Defensive Survey Editing)**：
  - 為了解決編輯問卷時題目增刪改對歷史作答紀錄關聯的破壞性，系統實作了防禦性的 `PUT /api/liff-questionnaires/<survey_key>` API。
  - 對於前端提交具有 `id` 屬性的題目，系統會直接進行 `UPDATE` 以保留其在 `liff_questionnaire_questions` 資料表中的原生資料庫識別碼，保護歷史答案（Answers）的完整性。
  - 對於新增加的題目，系統進行 `INSERT`。
  - 對於從題目清單中移除 of the 舊題目，則進行 `DELETE`。
  - **編輯防護狀態**：在載入與儲存修改的異步處理期間，系統會將儲存狀態設為 `saving`。此時除顯示載入/儲存中的 Toast 提醒外，亦會限制「取消編輯」按鈕變為停用（disabled），防範非預期狀態重置與競態衝突。
- **Clipboard 複製防禦與 Fallback**：
  - 由於各瀏覽器及非安全環境（如非 HTTPS 網域）中對新版 `navigator.clipboard.writeText` 有嚴格的權限與焦點限制，前端 `copyText` 設計了 try-catch 架構與以 textarea 為主體的舊版 `document.execCommand('copy')` 雙層相容性機制，確保複製失敗時不影響建立流程的主狀態變更。
- **資料庫表格設計 (Survey Database Schema)**：
  LIFF 問卷模組採用多租戶結構（以 `app_id` 作為資料表字尾進行隔離），主要使用以下 5 個表格：
  1. `liff_questionnaires:{app_id}`：存放問卷主檔（包含 `survey_key`, `title`, `status`, `start_time`, `end_time`, `finish_message` 等，已廢除並移除無作用之 `liff_id` 欄位）。
  2. `liff_questionnaire_questions:{app_id}`：存放問卷的問題細節。
     - `options` (JSONB)：存放該題目單選/多選之所有可用選項。
     - `condition_detail` (TEXT)：限制詳情，依據 `condition_type` 紀錄特定的限制參數（例如字數限制的範圍 `"5,20"`）。
     - 其它欄位如：`content`、`answer_type`、`required`、`tags` 等。
  3. `liff_questionnaire_responses:{app_id}`：存放使用者的填寫紀錄主檔（記錄哪位 LINE 用戶 `line_user_id` 在何時 `submitted_at` 提交了哪份問卷，並包含 `display_name` 與 `picture_url`）。
  4. `liff_questionnaire_answers:{app_id}`：存放使用者的具體作答答案明細（每題的回答 `answer_value`，並與 questions 和 responses 關聯）。
  5. `Private_var:{app_id}`：用戶私有變數與標籤資料表。當使用者提交問卷且回答觸發標籤附加時，系統會在此表的 `tags` 欄位中合併寫入對應標籤，完成用戶畫像標籤化。
  6. `v_liff_questionnaire_results:{app_id}` (平面化 VIEW)：
     - 整合了 `responses`、`questionnaires`、`answers` 與 `questions` 四張表格。
     - 目的為讓開發者/管理員能在一張平面表中一目了然看見「哪位使用者、在什麼時間、填寫了哪一份問卷、回答了哪個問題、答案是什麼」，避免物理性合併表格導致一對多關係被破壞或難以做資料統計。
- **GitHub Pages 前端部署與移地開發架構 (GitHub Pages Deployment)**：
  - **移地開發與部署**：前端填寫網頁已完全從主專案的 `superpages/liff-questionnaire/` 目錄中移除，遷移至獨立儲存庫目錄 `liff_questionnaire/index.html`，以利獨立版本管理與 GitHub Pages 託管。
  - **自動帶入 API Origin 參數**：當管理者點擊「複製連結」時，前端 React 應用會自動解析當前 Axios `api.defaults.baseURL` 或瀏覽器環境的 API Root Origin，並將其作為 `backend` 參數附加至 LIFF URL。這使得 LINE 客戶端能動態識別並連線至正確的後端 API 位置。
  - **LIFF 優先初始化 (LINE App Crash Prevention)**：
    - 為了解決 LINE 內置瀏覽器因過早執行慢速 API 請求而逾時秒退的問題，網頁在 `window.onload` 時優先執行 `liff.init()`，初始化完成後才進行問卷詳情的載入。
    - 網頁具備健全的錯誤防禦，若在 LINE App 內載入或初始化失敗，會中斷流程並顯示紅叉錯誤畫面（包含詳細錯誤訊息），便於管理者除錯與使用者排查。案切換（即監聽的依賴項變更）時，第一時間清空該頁面所有與前一專案相關的 React 狀態（如客戶名單、問卷列表、表單輸入、可用標籤等），確保載入期間不會暫時呈現舊專案的資料，徹底防範跨專案的資料污染與顯示混淆。
- **Request 攔截器防衛機制**：在前端 Axios 攔截器中，強制唯有在 `config.headers['X-OA-ID']` 尚未被手動設定（如背景預載所有 OA 的 API 請求）時，才從當前網址路徑匹配注入 OA ID。這確保了背景非同步發起跨 OA 查詢時，Header 不會被當前網址強行覆蓋，徹底阻斷了快取資料串線與混淆的成因。

## 5. 基礎架構與連線穩定性
- **連線池管理 (Connection Pooling)**：
  - 後端集中由 `backend/db_utils.py` 管理資料庫連線，全面移除私有實作。
  - 強制使用 `try...finally` 模式確保執行後連線確實歸還，杜絕連線外洩 (Connection Leak)。
  - **因應 RDS 升級優化**：全面採用 `psycopg2.pool.ThreadedConnectionPool` 取代原有的自製簡易佇列。各租戶 (OA) 連線池上限提升為 10，以充分利用升級後的 120 條連線額度，並增強連線自動回收與併發處理能力。
  - **SQLAlchemy 連線池與例外判斷防禦 (2026-08-05 變更)**：針對 Heroku 頻繁切換頁面出現的 `QueuePool limit` 與 503 錯誤，於 `backend/app.py` 將 SQLAlchemy 引擎連線池調升為 `pool_size: 10` 與 `max_overflow: 10`，啟用 `pool_pre_ping: True` 防止無效死連線；修正全域 Exception Handler 改以 `isinstance(e, HTTPException)` 判斷放行，防範 SQLAlchemy 2.0 之 `TimeoutError` 誤被回傳導致 Flask 拋出 `TypeError` 爆發 503 錯誤；並於 `load_oa_context` 採用 `CachedOAConfig` 實作 60 秒輕量記憶體快取與全域 `g.current_oa_config` 綁定，徹底消除圖文選單 400 錯誤與開銷；重構 `GET /api/users` SQL 語法為 CTE 結構 (`WITH target_users`)，將 `LIMIT 200` 前置至用戶階段；並將前端 `App.jsx` 的預載機制收斂為僅預載當前選取之單一 OA，前端移除 `/customers` 預載且後端 `GET /api/customers` 加入預設 `LIMIT 200` 防禦，徹底消除多重併發引發 503 瓶頸。
- **動態環境解析**：透過 WebSocket 觸發時，會動態從 `OAConfig` 取得對應的機器人名稱與 Namespace，確保與本地及雲端引擎皆能順利溝通。
- **CDN 整合**：圖片上傳整合 GitHub API，並自動轉為 `jsDelivr` CDN 連結，以符合 LINE Bot API 對圖片 URL 的嚴格要求。

## 6. LIFF 問卷管理與防禦性更新機制
- **LIFF問卷防禦性編輯 (Defensive Survey Editing)**：
  - 為了解決編輯問卷時題目增刪改對歷史作答紀錄關聯的破壞性，系統實作了防禦性的 `PUT /api/liff-questionnaires/<survey_key>` API。
  - 對於前端提交具有 `id` 屬性的題目，系統會直接進行 `UPDATE` 以保留其在 `liff_questionnaire_questions` 資料表中的原生資料庫識別碼，保護歷史答案（Answers）的完整性。
  - 對於新增加的題目，系統進行 `INSERT`。
  - 對於從題目清單中移除的舊題目，則進行 `DELETE`。
- **Clipboard 複製防禦與 Fallback**：
  - 由於各瀏覽器及非安全環境（如非 HTTPS 網域）中對新版 `navigator.clipboard.writeText` 有嚴格的權限與焦點限制，前端 `copyText` 設計了 try-catch 架構與以 textarea 為主體的舊版 `document.execCommand('copy')` 雙層相容性機制，確保複製失敗時不影響建立流程的主狀態變更。
- **資料庫表格設計 (Survey Database Schema)**：
  LIFF 問卷模組採用多租戶結構（以 `app_id` 作為資料表字尾進行隔離），主要使用以下 5 個表格：
  1. `liff_questionnaires:{app_id}`：存放問卷主檔（包含 `survey_key`, `title`, `status`, `start_time`, `end_time`, `finish_message` 等，已廢除並移除無作用之 `liff_id` 欄位）。
  2. `liff_questionnaire_questions:{app_id}`：存放問卷的問題細節。
     - `options` (JSONB)：存放該題目單選/多選之所有可用選項。
     - `condition_detail` (TEXT)：限制詳情，依據 `condition_type` 紀錄特定的限制參數（例如字數限制的範圍 `"5,20"`）。
     - 其它欄位如：`content`、`answer_type`、`required`、`tags` 等。
  3. `liff_questionnaire_responses:{app_id}`：存放使用者的填寫紀錄主檔（記錄哪位 LINE 用戶 `line_user_id` 在何時 `submitted_at` 提交了哪份問卷，並包含 `display_name` 與 `picture_url`）。
  4. `liff_questionnaire_answers:{app_id}`：存放使用者的具體作答答案明細（每題的回答 `answer_value`，並與 questions 和 responses 關聯）。
  5. `Private_var:{app_id}`：用戶私有變數與標籤資料表。當使用者提交問卷且回答觸發標籤附加時，系統會在此表的 `tags` 欄位中合併寫入對應標籤，完成用戶畫像標籤化。
  6. `v_liff_questionnaire_results:{app_id}` (平面化 VIEW)：
     - 整合了 `responses`、`questionnaires`、`answers` 與 `questions` 四張表格。
     - 目的為讓開發者/管理員能在一張平面表中一目了然看見「哪位使用者、在什麼時間、填寫了哪一份問卷、回答了哪個問題、答案是什麼」，避免物理性合併表格導致一對多關係被破壞或難以做資料統計。
- **GitHub Pages 前端部署架構 (GitHub Pages Deployment)**：
  - 系統於 `liff-questionnaire/index.html` 提供了一套獨立運行的靜態填寫網頁。
  - 該網頁可直接部署於 GitHub Pages 上作為 LIFF App 的 Endpoint URL。
  - 網頁初始化時，會調用 LINE LIFF SDK 初始化並獲取用戶 profile 或模擬測試身分。
  - 解析網址 query string 中的 `surveyId` (問卷的 `survey_key`) 與 `oaId`。
  - 呼叫後端公開 API `GET /api/liff-questionnaires/public/<survey_key>?oaId=<oaId>` 取得問卷資訊。
  - 使用者填寫完畢並通過輸入驗證（如手機 09 開頭 10 碼、Email 格式等）後，呼叫 `POST /api/liff-questionnaires/public/<survey_key>/responses?oaId=<oaId>` 提交作答，並在成功後自動顯示 `finish_message` 並關閉 LIFF 視窗。


### Heroku Deployment Architecture
- 使用 Heroku Multi-Buildpack 進行部署 (Node.js + Python)。
- Node.js buildpack 透過根目錄的 `package.json` 的 `postinstall` 觸發前端編譯。
- Python buildpack 讀取根目錄 `requirements.txt` 並透過 `Procfile` 使用 `gunicorn` 啟動 Flask 伺服器。
- Flask 負責統一伺服前端打包完成的靜態檔案與處理 SPA 路由。

## 9. 前端 UI 渲染與樣式約定 (2026-06-02 新增)
- **排版行為一致性**: 對於長列表 (如自動旅程的專案與排程列表)，統一採用受限的最大高度 (max-height: calc(100vh - 280px)) 搭配局部垂直捲動 (overflow-y: auto)，以避免長列表導致外層頁面無限延伸，破壞側邊欄與整體版面的結構。
- **React 排序穩定性**: 在依賴頻繁輪詢更新狀態 (如訊息中心) 的列表元件中，若依賴時間 (timestamp) 等非唯一值作為排序依據，必須加入次要排序鍵 (例如 user_id) 作為 Tie-breaker，防止因預設不穩定排序造成的畫面隨機跳動現象。
- **外部資源整合顯示**: 系統應優先整合並顯示對用戶友善的外部資源名稱 (如透過 LINE API 取得之 displayName)，取代內部技術命名，提升可用性。

## GitHub Settings Refactor (2026-06-04)
1. **GitHub 圖片上傳 (upload.py)**: 改為全域依賴環境變數 (GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH, GITHUB_PATH)，移除前台的設定 UI (AdminPage.jsx)，統一全站的 GitHub 儲存庫設定。


## 網路聲量雷達 (SocialRadar) & AI 洞察助理 (AiInsight) (新增於最新更新)
- **前端實作**: 在 App.jsx 註冊了新的路由 /oa/:oaId/social-radar 與 /oa/:oaId/ai-insight，並對應到新增的 SocialRadar 與 AiInsight React 元件。
- **後端整合**: 兩者作為新的 Page 記錄新增於資料庫，且授權給現有的 OAConfig。目前為施工中佔位頁面。

- **圖文選單圖片載入狀態 (2026-07-02 新增)**: 於圖文選單圖片尚未載入完成時顯示載入動畫，優化 UX。

## 10. 對話問卷管理 (Dialog Questionnaire) 命名規範 (2026-07-21 新增)
- **資料庫識別區隔**: 在 `Q_bank` 的 `note` 欄位中，對話問卷的格式由原本的後綴 ` - 問卷管理` 修改為前綴 `問卷管理 - {自訂名稱}`，以便於在資料庫層級或是系統管理介面上，能夠統一前綴排序並與 `關鍵字回覆 - {自訂名稱}` 等其他系統模組的命名習慣對齊。

## 11. WebSocket Namespace 動態解析機制 (2026-07-28 新增)
- **權限設定連線隔離 (`app_name`)**：系統全面廢除舊有硬編碼 namespace (`/websoc`) 或過時之 `socket_name` 欄位，WebSocket 連線與事件觸發發送 (含 `send_socket_event` 與 `send_socket_events_batch`) 統一從權限設定 (`OAConfig.other_settings`) 優先解析 `app_name` 作為 Namespace (`/{app_name}`) 與訊息事件名稱 (`{app_name}_message`)，實現各機器人平台即時連線的嚴格隔離與動態綁定。
- **預設測試標籤注入 (`is_test`)**：發送所有 WebSocket 事件時，`socket_utils` 模組會自動檢查並為 Payload 字典注入 `"is_test": False` 預設屬性（除非呼叫端已明確指定），以利後端機器人引擎進行測試與正式連線之識別與區隔。

## 12. 加入好友設定 (Follow Rules) 模組架構 (2026-07-31 新增)
- **架構設計**：加入好友設定完全基於 `Q_bank:{app_name}` 資料表中 `type = 'Follow'` 的法則列進行管理，無需新增獨立資料表。
- **啟用狀態 (`content`)**：啟用時設為 `'*'`；停用時設為 `'OFF'`。
- **單一啟用檔護與提示**：同一時間只允許一個加入好友設定處於啟用狀態 (`content = '*'`)。若已有被啟用的加入好友訊息設定，當嘗試啟用其他設定時，前端與後端均會直接攔截並提示「已有被啟用的加入好友訊息設定，請先停用該設定後再嘗試啟用此設定。」，確保絕對不會非預期覆蓋。
- **固定語法注入 (`function`)**：所有透過該模組儲存之法則，其 `function` 欄位強制包含 `pri_set("name",sys.name(m)),pri_set("pic",sys.picture(m))`，以確保 LINE 用戶加入時自動保存姓名與頭貼 URL。後續 CRM 動作（標籤、圖文選單切換、自動旅程）則附加於該基本語法後。
- **`note` 欄位標記**：所有法則之 `note` 欄位強制包含 `加入好友訊息` 標記（如：`加入好友訊息 - 歡迎光臨`）。
- **無啟用法則時之預設機制 (Default Fallback)**：當檢測到資料庫中完全沒有啟用的 Follow 法則時，系統自動初始化一則預設加入好友法則，帶有預設歡迎訊息與條件式圖文選單切換語法 `[update(f"switch_rm|{x['ui_uuid']}") for x in getTable(...)[:1]]`（若無預設選單則完全不執行 update）。
- **欄位規格與歷程記錄**：所有 Follow 法則寫入 `Q_bank:{app_name}` 時，`state_out` 欄位固定設為 `'00000'`，`history` 欄位固定設為 `TRUE` (`True`)。

## 13. 群發數據統計與 CRM 後續轉換紀錄 (MVP v1.3) 架構 (2026-07-31 新增)
- **資料表設計**:
  - `broadcasts:<app_name>`: 擴充 `request_id`, `custom_aggregation_unit`, `sent_recipient_count` ($N$), `statistics_updated_at` 欄位。
  - `broadcast_recipients:<app_name>`: 紀錄群發發送時的受眾快照清單 (`broadcast_id`, `user_id`, `send_status`, `sent_at`)。
  - `broadcast_line_stats:<app_name>`: 儲存來自 LINE Official Insights API 抓取之 `delivered`, `unique_impression`, `unique_click`, `unique_media_played`, `unique_media_played_100_percent` 快照，採 15 分鐘 TTL 限流保護機制。
- **11 個 LINE 官方互動指標與 API 對應**:
  - `Request ID API` (`/v2/bot/insight/message/event?requestId=...`) 與 `Unit API` (`/v2/bot/insight/message/event/aggregation?customAggregationUnit=...`) 雙軌對應，處理 `overview.delivered` 呈現差異與母數標記。
- **6 個 CRM 後續關聯行為與 `ht_view` Live 查詢**:
  - 以受眾快照 (`broadcast_recipients`) 為基礎，直接針對 `ht_view:<app_id>` 資料庫視圖在指定時間區間 (`1d`, `3d`, `7d`, `30d`) 進行 live 查詢：
    - 新增任一標籤人數 (排除 `manual`, `unknown`) 與各標籤新增人數明細對應。
    - 加入任一旅程人數 (`status = 'success'`) 與各旅程加入人數明細對應。
    - 有後續行為人數 (標籤與旅程受眾之聯集去重 `COUNT(DISTINCT user_id)`) 與後續行為率 (`union_count / N`)。
- **前端介面 (`BroadcastStatsModal.jsx`)**:
  - 在群發卡片新增「成效」按鈕，展開彈窗儀表板呈現 17 項數據指標與時間區間切換控制。

## 14. 關鍵字排行統計與未命中訊息排行 (MVP v1.1) 架構 (2026-08-03 新增)
- **零 DB 變動與動態比對架構**:
  - 完全不更動 PostgreSQL 關聯結構與 DB 欄位，亦不改動 `Line-Bot-Main`。
  - 後端 `GET /api/statistics/keywords` API 即時對 `history:{app_id}` 的有效訊息與 `Q_bank:{app_id}` 啟用的關鍵字法則進行文字標準化比對。
- **文字標準化與無效訊息過濾**:
  - 標準化演算：英文轉小寫、全形/半形轉置、去頭尾與連續多餘空白。
  - 無效訊息過濾：自動排除純空白、標點符號、純 Emoji、純網址 URL、圖片/貼圖/影片及系統管理員 (`yzuadmin`, `system`) 訊息。
- **指標與雙排行統計**:
  - **整體指標**: 計算 `overall_match_rate` (整體關鍵字命中率 %)、`matched_total_count` (命中總次數)、`unmatched_total_count` (未命中總次數)。
  - **規則命中排行**: 統計每條 Q_bank 法則的 `hit_count` (命中次數)、`unique_users` (獨立人數) 與 `percentage` (命中占比 %)。自動清除 `|UPDATED:XXXX` 時間戳記與系統前綴/字尾。點擊規則名稱可導向 `/rule-designer` 法則編輯頁面。
  - **未命中訊息排行**: 整理未命中訊息之 `count` (出現次數) 與 `unique_users` (獨立使用者數)。點擊「建立規則」按鈕可帶入該未命中訊息文字跳轉至 `RuleDesigner` 並預填建立新規則。
- **前端整合 (`Statistics.jsx` & `RuleDesigner.jsx`)**:
  - `Statistics.jsx` 重構為頂部三大指標卡片 + 雙頁籤切換表格與全方位 CSV 匯出（單一檔案包含規則命中與未命中排行兩大區塊）。
  - `RuleDesigner.jsx` 支援讀取 URL 關鍵字參數，開啟時自動創建預填 draft rule。





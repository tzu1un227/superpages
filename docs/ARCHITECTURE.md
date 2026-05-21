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
3. **觸發發送 (Trigger)**：從 `project_schedules` 提取訊息內容，並透過 Socket.IO 發送事件給目標用戶。
4. **推進階段 (Advancement)**：計算下一次執行的時間 (`interval_hours`)，並更新 `cron_table`。若無下一階段，則依據 `is_recurring` 設定將狀態改為完成 (`completed`) 或重新循環。

### 4.2 圖文選單管理 (Rich Menu Management)
- 透過視覺化編輯器進行圖文選單的創建與修改。
- 支援多種動作：`message`, `uri`, `postback`, `richmenuswitch`。
- **LIFF 標籤追蹤**：支援在「開啟連結」動作中設定標籤，系統會自動生成 LIFF 代理連結 (Proxy URL)，在跳轉前先透過 WebSocket 標記用戶，以利後續客群分析。
- **多租戶 metadata 資料表**：圖文選單的排程中繼資料 (Metadata) 以 `rich_menu_metadata:{appname}` 命名，與系統其他業務表格命名規範一致。存取由 `endpoints/richmenu.py` 的 `get_t()` 函數動態解析，並於首次呼叫時自動建立資料表（透過 `ensure_rds_tables`）。
- **定時排程同步引擎（`rich_menu_scheduler_processor`）**：背景任務每 60 秒執行一次，以 OAConfig 為單位，對每個 App 執行「最佳有效選單計算」—在同一時間點找出唯一應生效的選單，與 LINE 伺服器的實際預設選單 ID 進行比對後，才做出最小化的 Link/Unlink 動作，避免競態衝突。
- **雙記憶體快取加速 (Double Memory Caching)**：
  - **前端快取**：於 `RichMenu.jsx` 使用模組全域級別的 `frontendImageCache` 對下載的 Blob Object URL 進行永續儲存。大幅減少不必要的重複 API 查詢與瀏覽器記憶體解碼，切換視圖及渲染速度達到 0ms 的響應效率。
  - **後端快取**：於 `endpoints/richmenu.py` 引入全域 `_IMAGE_CACHE` 記憶體字典。當用戶端向 Flask 請求 LINE 圖片資源時，後端不再每次請求都經由慢速的國際網路向日本 LINE API 發起下載，而是直接由記憶體快取以微秒級速度回傳，並在進行選單刪除時精確同步清除快取，保證資料的一致性。


### 4.3 訊息與廣播中心 (Broadcast & Message Center)
- **訊息廣播**：支援針對所有用戶、特定標籤或特定 ID 名單發送訊息，支援最多 5 個 Bubble (支援文字、圖片、影片、Flex)。
- **訊息預覽**：後端會自動從 `QA_bank` 中提取並解析訊息摘要，前端亦內建 `JourneyPreview` 提供 Flex Message 即時預覽。
- **防禦性渲染 (Defensive Rendering)**：使用 Error Boundary 及可選串連 (Optional Chaining) 確保含有不完整舊資料時，UI 依然能穩定運行。
- **編輯器雙向綁定競態阻斷 (Bidirectional State Guard)**：
  - 在 `FlexMessageEditor` 的 auto-save 機制中引入 `lastSavedJsonRef` 快取技術。
  - 當編輯器將狀態自動儲存至父元件後，父元件所產生的非同步狀態回流（Prop updates）在抵達子元件時，子元件會比對 `lastSavedJsonRef` 以確認是否為編輯器自身觸發的回流。
  - 若是自身觸發則直接忽略，不重新載入或重設 `cards` 本機狀態，藉此完美解決非同步圖片上傳完成與打字等多執行緒操作下的競態回溯問題。

### 4.4 法則表設計器 (Rule Designer)
- **雙模式編輯**：提供「簡易模式」(卡片式任務管理，適合非技術人員) 與「工程模式」(直接編輯 JSON 與條件式，適合進階使用者)。
- **自動化除錯**：在建立或更新法則時，後端會自動透過 Python `ast.parse` 等機制驗證語法、參數與 `QA_bank` 標籤的正確性。

### 4.5 資料庫檢視器 (Database Viewer)
- 提供 `/dbviewer` 介面，讓管理者能動態瀏覽公開的資料表。
- 支援分批載入 (Chunked loading)、文字搜尋 (`ILIKE`) 及前端快取機制。
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
3. **觸發發送 (Trigger)**：從 `project_schedules` 提取訊息內容，並透過 Socket.IO 發送事件給目標用戶。
4. **推進階段 (Advancement)**：計算下一次執行的時間 (`interval_hours`)，並更新 `cron_table`。若無下一階段，則依據 `is_recurring` 設定將狀態改為完成 (`completed`) 或重新循環。

### 4.2 圖文選單管理 (Rich Menu Management)
- 透過視覺化編輯器進行圖文選單的創建與修改。
- 支援多種動作：`message`, `uri`, `postback`, `richmenuswitch`。
- **LIFF 標籤追蹤**：支援在「開啟連結」動作中設定標籤，系統會自動生成 LIFF 代理連結 (Proxy URL)，在跳轉前先透過 WebSocket 標記用戶，以利後續客群分析。
- **多租戶 metadata 資料表**：圖文選單的排程中繼資料 (Metadata) 以 `rich_menu_metadata:{appname}` 命名，與系統其他業務表格命名規範一致。存取由 `endpoints/richmenu.py` 的 `get_t()` 函數動態解析，並於首次呼叫時自動建立資料表（透過 `ensure_rds_tables`）。
- **定時排程同步引擎（`rich_menu_scheduler_processor`）**：背景任務每 60 秒執行一次，以 OAConfig 為單位，對每個 App 執行「最佳有效選單計算」—在同一時間點找出唯一應生效的選單，與 LINE 伺服器的實際預設選單 ID 進行比對後，才做出最小化的 Link/Unlink 動作，避免競態衝突。
- **雙記憶體快取加速 (Double Memory Caching)**：
  - **前端快取**：於 `RichMenu.jsx` 使用模組全域級別的 `frontendImageCache` 對下載的 Blob Object URL 進行永續儲存。大幅減少不必要的重複 API 查詢與瀏覽器記憶體解碼，切換視圖及渲染速度達到 0ms 的響應效率。
  - **後端快取**：於 `endpoints/richmenu.py` 引入全域 `_IMAGE_CACHE` 記憶體字典。當用戶端向 Flask 請求 LINE 圖片資源時，後端不再每次請求都經由慢速的國際網路向日本 LINE API 發起下載，而是直接由記憶體快取以微秒級速度回傳，並在進行選單刪除時精確同步清除快取，保證資料的一致性。


### 4.3 訊息與廣播中心 (Broadcast & Message Center)
- **訊息廣播**：支援針對所有用戶、特定標籤或特定 ID 名單發送訊息，支援最多 5 個 Bubble (支援文字、圖片、影片、Flex)。
- **訊息預覽**：後端會自動從 `QA_bank` 中提取並解析訊息摘要，前端亦內建 `JourneyPreview` 提供 Flex Message 即時預覽。
- **防禦性渲染 (Defensive Rendering)**：使用 Error Boundary 及可選串連 (Optional Chaining) 確保含有不完整舊資料時，UI 依然能穩定運行。
- **編輯器雙向綁定競態阻斷 (Bidirectional State Guard)**：
  - 在 `FlexMessageEditor` 的 auto-save 機制中引入 `lastSavedJsonRef` 快取技術。
  - 當編輯器將狀態自動儲存至父元件後，父元件所產生的非同步狀態回流（Prop updates）在抵達子元件時，子元件會比對 `lastSavedJsonRef` 以確認是否為編輯器自身觸發的回流。
  - 若是自身觸發則直接忽略，不重新載入或重設 `cards` 本機狀態，藉此完美解決非同步圖片上傳完成與打字等多執行緒操作下的競態回溯問題。

### 4.4 法則表設計器 (Rule Designer)
- **雙模式編輯**：提供「簡易模式」(卡片式任務管理，適合非技術人員) 與「工程模式」(直接編輯 JSON 與條件式，適合進階使用者)。
- **自動化除錯**：在建立或更新法則時，後端會自動透過 Python `ast.parse` 等機制驗證語法、參數與 `QA_bank` 標籤的正確性。

### 4.5 資料庫檢視器 (Database Viewer)
- 提供 `/dbviewer` 介面，讓管理者能動態瀏覽公開的資料表。
- 支援分批載入 (Chunked loading)、文字搜尋 (`ILIKE`) 及前端快取機制。

### 4.6 客戶中心與資料編輯 (Customer Center & Data Management)
- **客戶資料庫結構**：每個用戶的「名稱」、「手機」、「電子信箱」、「標籤」以及「客群」均以鍵值對 (Key-Value) 形式存放在 PostgreSQL 中的 `Private_var:{app_id}` 資料表中。
- **編輯客戶資訊**：提供 `PUT /api/customers/<user_id>` 端點，允許對 `Private_var` 中特定 user_id 的 `'name'`、`'phone'` 與 `'email'` 等變數值進行安全 upsert（即先以 `UPDATE` 更新，若異動行數為 0 則以 `INSERT` 新增）。這確保了動態欄位更新的安全性與資料完整性。

## 5. 基礎架構與連線穩定性
- **連線池管理 (Connection Pooling)**：
  - 後端集中由 `backend/db_utils.py` 管理資料庫連線，全面移除私有實作。
  - 強制使用 `try...finally` 模式確保執行後連線確實歸還，杜絕連線外洩 (Connection Leak)。
  - **因應 RDS 升級優化**：全面採用 `psycopg2.pool.ThreadedConnectionPool` 取代原有的自製簡易佇列。各租戶 (OA) 連線池上限提升為 10，以充分利用升級後的 120 條連線額度，並增強連線自動回收與併發處理能力。
  - **主資料庫連線設定**：系統的主資料庫 URL (`RDS_URL`) 定義於後端 `app.py`、`db_utils.py`、`endpoints/broadcast.py` 與測試用資料寫入腳本 `insert_test_data.py` 中，用於連接系統主資料庫，管理使用者與權限設定。由於 SQLAlchemy 1.4+ 不再支援舊的 `postgres://` 協定頭，此連線字串必須以 `postgresql://` 開頭以防止啟動錯誤。
- **動態環境解析**：透過 WebSocket 觸發時，會動態從 `OAConfig` 取得對應的機器人名稱與 Namespace，確保與本地及雲端引擎皆能順利溝通。
- **CDN 整合**：圖片上傳整合 GitHub API，並自動轉為 `jsDelivr` CDN 連結，以符合 LINE Bot API 對圖片 URL 的嚴格要求。

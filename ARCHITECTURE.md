# Architecture Documentation

## System Overview
This project is a web application with a Flask backend and a React frontend. It manages users, projects, and scheduled events, integrating with a Socket.IO server for real-time communication.

## Scheduled Event Management (定時觸發事件 - Refactored)

All scheduling is now managed via **Projects** using the `cron_table`. The legacy `scheduled_events` table and processor have been removed.

### Core Components
1.  **Backend Processor**: `cron_scheduler_processor` in `backend/app.py`.
    -   Type: Background Daemon Thread.
    -   Interval: Checks database every 10 seconds.
2.  **Database**: 
    -   `projects`: Defines the project configuration (`is_enabled`, `is_recurring`, etc.).
    -   `project_schedules`: Defines the steps and messages for each project.
    -   `cron_table`: Tracks the current state (`step_id`, `scheduled_at`, `status`) for each user participating in a project.
3.  **Frontend**: `Projects.jsx` (Route: `/projects`).
    -   Provides UI for creating projects, defining schedules, and monitoring status.

### Execution Logic
1.  **Polling**: The processor wakes up every 10 seconds.
2.  **Selection**: Queries `cron_table` joined with `projects` for rows where:
    -   `status` is 'active'.
    -   `scheduled_at` <= Current Time.
    -   Project is enabled (`is_enabled = TRUE`).
3.  **Trigger**:
    -   Fetches the message content from `project_schedules` for the current `step_id`.
    -   Connects to the Socket.IO server (`WS_URL` or OA-specific URL).
    -   Emits a message event to the target user.
4.  **Advancement**:
    -   Calculates the next execution time based on the *next* step's `interval_hours`.
    -   Updates `cron_table` with the new `step_id` and `scheduled_at`.
    -   If no next step exists:
        -   If `is_recurring` is TRUE: Resets to Step 0 (Loop).
        -   If `is_recurring` is FALSE: Sets `status` to 'completed'.

### Projects and Schedules
-   **Structure**: A Project consists of multiple Steps (0, 1, 2...).
-   **Step 0**: The initial trigger or first delay.
-   **Recurrence**: Projects marked as `is_recurring` will automatically restart from Step 0 for a user after the last step is delivered.

### Rich Message Handling
-   **QA Integration**: Messages can be stored as complex structures (Flex, Image, etc.) in the `qa_bank` table.
-   **Reference Protocol**: In `project_schedules` or other text fields, these are referenced using the `QA|` prefix followed by the unique tag (e.g., `QA|cron_project_step`).
- **Schedule Settings**: Managed within the `ProjectsManagement` component in `Projects.jsx`. Supports multi-step messaging workflows with configurable delay intervals (Days/Hours/Minutes).
- **Rich Message Previews**: The `get_schedules` API endpoint automatically enriches schedule entries with descriptive previews for Linked QA bank tags. It parses the first message from the message sequence (text, flex, image, etc.) and provides a human-readable summary.
- **Frontend Robustness**: Implementation uses defensive coding patterns (optional chaining, array guards, fallback values) to ensure UI stability even with incomplete or malformed backend data.
- **Editor Behavior**: The frontend detects this prefix to open the advanced visual editor instead of a plain text input.
- **Image Upload**: The Flex Message Editor includes an upload button that allows users to upload images directly to a configured GitHub repository. The backend handles the GitHub API integration and returns the raw image URL.

### UI/UX Optimization & Content Validation
- **Global Toast Notification**: A centralized `ToastContext` and `Toast` component handle system notifications, providing non-blocking feedback that auto-hides after 5 seconds.
- **Broadcast Content Preview**: The backend `/broadcast/` list endpoint performs on-the-fly reconciliation and fetches message summaries from the OA's `QA_bank` for responsive frontend previews.
- **Inline Flex Preview**: The broadcast editor incorporates a scaled-down `JourneyPreview` to provide immediate visual feedback for Flex message structures without context switching.
- **Rich Menu Management**: Standardized to Chinese (Traditional). Implemented form validation (disabling save unless an image and all area actions are properly configured) and fixed runtime crashes using optional chaining and safe state resets.
- **Rich Menu Localization**: TERMINOLOGY in the Rich Menu module is standardized to Chinese to improve usability for non-English speakers.

### UI/UX 優化與內容驗證 (UI/UX Optimization & Content Validation) [2026-03-18]
- **圖文選單 (Rich Menu)**:
    - **載入失敗處理**: 分離主清單 (`/richmenu/`) 與別名清單 (`/richmenu/aliases`) 的 API 錯誤攔截。若主清單失敗，將根據 HTTP 狀態碼提供具體原因（如「尚未設定 LINE Token」）；別名清單失敗則採靜默處理，不阻擋頁面主體渲染。
    - **上傳提示強化**: 於底圖上傳區明確標示 `≤1MB` 的檔案大小限制。
- **訊息中心 (Message Center)**:
    - **側邊欄虛擬分頁 (Virtual Pagination)**: 針對用戶清單實作基於滾動事件的前端虛擬分頁機制。初始載入 15 筆，當使用者向下滑動至底部時動態追加上一頁資料，在不修改後端 API 結構的前提下大幅提升渲染效能與初始讀取感受。
- **自動旅程 (Projects)**:
    - **標籤視覺化 (Tag Badges)**: 在手動加入用戶的彈出視窗 (`UserSelectModal`) 中，復用並優化了標籤解析邏輯 (`parseTags`)。將原本以字串拼接形式呈現的原始標籤陣列，轉換為獨立、圓角的 pill/badge 樣式呈現，提升操作介面的直觀性。

### UI/UX 優化與內容驗證 (UI/UX Optimization & Content Validation) [2026-03-10]
- **Loading 狀態管理**: 
    - 實作 `Projects.jsx` 中的 `pageLoading` 狀態，當切換「自動旅程」分頁或選取不同專案時，會觸發 `LoadingSpinner` 並在 API 回傳前清空舊數據。
    - 確保用戶在切換專案時，排程列表與統計數據不會出現跨專案的殘留顯示。
    - **競態條件與資料殘留修復 (2026-03-30)**：
        - 在 `fetchSchedules` 中加入 `selectedProjectIdRef` 比對鎖，確保異步回傳時若已切換旅程則不更新舊資料。
        - 在 JSX 渲染層對 `schedules` 列表實施 `filter(s => s.project_id == selectedProjectId)` 之防禦性過濾。
- **進階訊息編輯器深度驗證**: 
    - 強化 `Projects.jsx` (RichMessageModal) 與 `Broadcast.jsx` 的儲存驗證邏輯。
    - 深度解析 Flex Message JSON 結構，針對所有卡片 (Bubbles) 的「圖片點擊動作 (Hero Action)」與「按鈕動作 (Footer Buttons)」進行非空檢查。
    - 若連結 (URI)、回傳文字 (Text/Data) 為空，系統將會攔截儲存並提示使用者補齊。
- **參與用戶列表優化**:
    - **隱私與簡潔**: 移除主清單與手動加入清單中的 User ID 顯示，優先顯示使用者名稱，若無則顯示「未命名」。
    - **標籤解析**: 針對手動加入彈窗 (`UserSelectModal`) 中的標籤顯示，實作了兼容 JSON List (`["A","B"]`) 與 Pipe 分隔標記 (`|A|B|`) 的強健解析邏輯，確保標籤能作為獨立欄位美觀呈現。

- **捲軸行為最佳化 (Message Center)**: 針對 `MessageCenter.jsx` 的 7 秒自動輪詢更新，導入位置保護機制與 `isAtBottom` 智慧判斷，解決畫面跳動與自動下拉至底部的困擾。
- **廣播預覽**: 實作前端 `messages` 列表預覽邏輯，提取各類訊息特徵（Type Icon + 文字截斷）顯示於廣播歷史清單中。

 ### User Tagging (用戶標註)
 - **Flex Message Integration**: The Flex Message Editor allows users to associate multiple tags with button actions or image clicks.
 - **Protocol**: Tags are embedded in the `postback.data` payload using the `|set_tag|tag1|tag2|...` command suffix.
 - **Event Splitting (Simulation)**: For simulation/websocket triggers, the Superpages backend splits combined data into two events (Message + Postback) to ensure correct rule matching and tagging simultaneously.
 - **Frontend Component**: `TagInput.jsx` provides a dedicated UI for multi-tag selection with autocomplete support fetching from `/api/tags`.
 
### Lottery Management (抽獎管理)

#### Components
1.  **Frontend**: `PrizeStatus.jsx`.
    -   Displays `gameStatus` (Fetched from `/api/game-status`, source: `Global_var:5013` -> `SYS_STAT`).
    -   Lists prizes (`tickets`) from `ticket_table`.
    -   Provides controls to Start/Stop game (via direct socket triggers) and manage prizes (Delete/Create).
    -   Displays "Registered Users" list (Name + Partial UserID).

2.  **Database**:
    -   `ticket_table`: Stores the list of prizes (`id`, `name`, `order`, `user_id`).
    -   `person_table`: Stores user information (`name`, `user_id`, etc.) for the registered users list.
    -   `Global_var:5013`: Stores the system status key `SYS_STAT` ("WAIT" = Not Started, "RUN" = In Progress).

3.  **Endpoints**:
    -   `GET /api/game-status`: Returns the current game status.
    -   `DELETE /api/tickets/<id>`: Deletes a specific prize.
    -   `GET /api/registered-users`: Fetches list of registered users. Supports `source` parameter:
        -   `source=private_var` (default): Fetches from `Private_var` (requires `name` and `pic`), used for Projects.
        -   `source=person_table`: Fetches from `person_table` (returns `user_id`, `name`), used for Lottery.
    -   `get_tickets` and `trigger_socket_event` (existing).

### Message Center (訊息中心)
- **Frontend**: `MessageCenter.jsx`.
  - Displays list of users and their chat history.
  - Supports sending messages and managing tags.
  - **發送連發防護 (Anti-Double Send)**: 實作 `isSendingRef` (Ref Lock) 與 `isSending` (State) 機制。當發送中時會暫時禁用輸入框與按鈕，並攔截後續的 Enter 鍵或點擊事件，防止重複發送。
  - **自動旅程管理 (Projects Management)**:
    - **訊息編輯器 (RichMessageModal)**: 支援文字、圖片、影片、語音與 Flex 訊息。包含欄位完整度驗證（防止空內容）。
    - **排程邏輯**: 確保 Step 0 作為旅程起點不可刪除，維護流程完整性。
    - **用戶管理 (UserSelectModal)**: 整合 `/api/registered-users` 與 `/api/tags`，支援複合式（名稱 + 標籤）搜尋，提供視覺化標籤篩選控制項。
  - **問卷管理 (Questionnaire)**:
    - **動態狀態產生**: 系統自動產生 `Q[ID][SEQ]` 模式的狀態。若啟用「答案檢查」，則會額外產生一個跳轉至 `Q[ID]99` 的回顧狀態。
    - **時間限制邏輯**: 利用 `sys.now_between` 或 `sys.now()` 比較邏輯，在問卷入口規則的 `check` 欄位中實現時段判斷。
    - **資料持久化**: 每一題的答案會透過 `pri_set` 儲存於 `ans_{問卷名稱}_Q{題號}`，並在回顧階段透過 `sys.pri_get` 動態讀取呈現。
  - **群發訊息 (Broadcast)**:
    - **發送驗證**: 在發送或儲存草稿前進行深度訊息內容檢測（包含 Flex 內的連結與按鈕動作）。
  - **用戶清單搜尋 (User List Search)**:
    - 搜尋框綁定 `searchQuery` state，透過 debounce（300ms）後發送 API 請求，支援依 `user_id` 與使用者名稱搜尋。
    - 搜尋框具備即時清除按鈕（X）。
  - **標籤篩選 (Tag Filtering)**:
    - 載入所有可用標籤並顯示為可點選的標籤按鈕列表（含「全部」選項）。
    - 點選標籤後，以 `tag` query parameter 傳入 `/api/users`，僅回傳擁有該標籤的用戶。
  - **快取與狀態管理 (Cache & State Management)**:
    - 導入 `messagesCacheRef` 作為切換用戶時的記憶體快取，使得切換回已開啟的聊天室能瞬間載入舊訊息。
    - 結合 `after` 時間戳的背景輪詢，自動補齊快取後的增量新訊息，實現零等待的無縫切換體驗。
  - **捲軸位置管理與防跳動 (Scroll Management)**:
    - **位置持久化 (Scroll Persistence)**: 使用 `userScrollPositionsRef` (Mutable Ref) 紀錄每個用戶的 `distanceFromBottom` 與 `scrollTop`。
    - **智慧置底與記憶恢復**: 切換用戶時，若有大於 100px 的向上捲動紀錄，則恢復 `scrollTop`；否則執行 `scrollToBottom`。
    - **防跳動定位 (useLayoutEffect)**: 當載入剩餘歷史訊息（向上撐開）時，利用 `React.useLayoutEffect` 在瀏覽器重繪前計算 `scrollHeight` 差值並補齊 `scrollTop`，實現視覺上的無縫定位。
    - **穩定 DOM Key**: 訊息列表使用結合 `timestamp` 與 `index` 的穩定字串作為 `key`，防止 React 在更新時銷毀重建 DOM 節點導致捲軸遺失。
  - **圖片/媒體載入同步化 (LazyImage)**:
    - **核心機制**: 為了解決非同步媒體載入導致的版面推擠（Layout Shift），導入 `LazyImage` 元件。媒體元件在瀏覽器觸發 `onLoad` 完成渲染前，將以隱形狀態結合佔位框顯示，確保容器高度在可見前已確定。
    - **即時置底**: 媒體載入完畢後，若 `isAtBottomRef` 為真，則立刻調用 `scrollToBottom`。
  ### 訊息中心與內容代理 (Message Center & Content Proxy)
為了確保能正常顯示 LINE 伺服端的使用者媒體（如圖片、影片），系統實作了後端 Proxy 路由：
- `/api/line/content/<message_id>`: 會附帶官方帳號的 `line_token` 請求 LINE API 並回傳二進位資料。
- 前端使用 `AuthenticatedImage` 元件，透過 `api.get` (帶有 JWT Token) 獲取內容並轉為 Blob URL 顯示。
  - **對話內容搜尋 (Message Content Search)**:
    - 聊天室上方有獨立搜尋框，可搜尋當前選用用戶的對話內容。
    - 符合的關鍵字以黃色背景高亮顯示（透過 `highlightText` 函式），並顯示符合筆數。
  - **Message Display**:
    - Messages from `yzuadmin`, or with category `Sensor`, `Response`, or `sys_reply` are displayed on the right (Admin/System side).
    - `sys_reply` messages are displayed with rich content (text/image/video/audio/flex).
- **Backend**:
  - `GET /api/users`: 新增 `q`（關鍵字）和 `tag`（標籤）查詢參數。
    - **深度檢索邏輯**：`q` 參數會比對 `user_id`、姓名（Private_var），以及 `history` 表中的對話內容。
    - **Unicode 轉義處理**：自動將搜尋關鍵字轉義為 `\uXXXX` 序列（並進行雙重轉義比對），確保能搜尋到 JSON 格式中儲存的 Unicode 編碼中文字內容。
    - **QA_bank 整合**：若 `history` 內容為 QA 標籤（如 `cron|QA|...`），會自動聯結 `QA_bank` 表搜尋其對應的訊息內容（`ans` 和 `msg_rpy`），同時支援 Unicode 轉義比對。
  - `GET /history/<user_id>`: 獲取指定用戶的完整聊天紀錄。

## Data Analysis & Statistics (數據分析與統計)

### Core Components
1. **Integrated Project Metrics**: Located within `Projects.jsx` -> `activeTab === 'schedules'`.
    - 顯示專案特定指標：完成率 (completion_rate) 優先顯示於上方，其次為總完成次數 (tcc)、觸發客戶數 (tc)、成功/失敗數 (mss/msf)。
   - Metrics are filtered by the selected project and the specified date range.
2. **Global Account Analysis**: Located within `Statistics.jsx`.
    - **Trend Analysis**: Fetches grouped data from `/api/statistics`. (Global metrics: 總訊息量, 新增好友數 [資料庫 Follow], 封鎖/解除數 [資料庫 Unfollow], 有效好友數 [該時段內每日活躍人次])。
    - **Total Calculation**: The backend now also returns `total_counts` for the selected period. The "Effective Friend Count" card displays a strictly distinct user count for the entire duration, avoiding double-counting of recurring active users.
    - **Unfollow Tracking**: The Line-Bot engine captures `UnfollowEvent` and records it in history as an `Unfollow` category, which is then aggregated by the dashboard.
    - **Keyword Ranking**: Fetches data from `/api/statistics/keywords` (Top keyword rankings).
    - **Keyword Tag Filtering**: 關鍵字排行區塊內建標籤篩選 UI (pill-style 按鈕列，資料來源 `/api/tags`)。選擇特定標籤後，前端帶 `tag` query 參數呼叫後端 `get_keyword_ranking` SQL 函式，僅回傳該標籤用戶的關鍵字統計。關鍵字資料擷取獨立為 `fetchKeywords` 函式，切換標籤不會觸發趨勢圖表重新載入。
    - **WebSocket Dynamic Resolution**: `send_socket_event` resolves `bot_name` and `namespace` from `OAConfig`, defaulting to `websoc`. This ensures compatibility with both local and Heroku-hosted bot engines without hardcoding.
- **WebSocket Stability (Heroku)**: Uses single-namespace connection handshakes to avoid Heroku's multi-namespace connection failures.
- **Message Center UI Enhancements**:
  - Integrated `useToast` for reliable 5-second auto-hide notifications.
  - Implemented immediate state updates for tag addition/deletion to prevent UI lag.
  - **標籤操作同步邏輯 (Tag Operation Synchronization Logic)**: 引入 `pendingTagDeletionsRef` 與 `pendingTagAdditionsRef` (Mutable Ref) 追蹤正在進行中的標籤操作。
    - **非樂觀更新 (Non-Optimistic approach)**：根據使用者要求，移除了立即修改本地 State 的樂觀更新邏輯。現在系統會等待 API 回傳成功後，再觸發 `fetchUsers` 重新抓取。
    - **雙向時間戳記護欄 (Bilateral Timestamp Guarding)**：採用 10 秒時間戳記保護機制。當 `fetchUsers` 輪詢回傳伺服器資料時，會自動處理：
        1. **刪除護欄**：濾掉 10 秒內被刪除的標籤。
        2. **新增護欄**：自動補回 10 秒內新增但伺服器尚未更新的標籤。
    - **技術成效**：既滿足了使用者希望「確診後再更新」的需求，又徹底解決了因後端（Line-Bot-Main）非同步處理延遲導致的標籤「消失又出現/出現又消失」的視覺閃爍問題。
    - **視覺狀態同步**：操作進行中的標籤與刪除按鈕會同步維持 10 秒的穩定狀態，並顯示「刪除中」提示，提供明確的 UX 反饋。
  - **訊息中心穩定排序機制 (Stable Sorting Mechanism)** [2026-04-13]:
    - **問題修復**：解決了因多個用戶具有相同的 `last_time` 導致 SQL 回傳順序不一致的跳動問題。
    - **實作方式**：在 `get_users_list` 的 `ORDER BY` 語句中加入 `user_id` 作為確定性的第二排序基準，確保在背景刷新時 UI 位置絕對穩定。
  - **自動旅程全境台灣時間修復 (Project & Timezone Sync Fix)** [2026-04-10]:
    - **同步時區模式**：取消 UTC 轉換，實作網頁輸入、資料庫儲存與顯示「三位一體」的台灣時間模式。修復了 8 小時的顯示與執行偏差。
    - **全境台灣時間模式 (Full Taiwan Time Mode)**：為了符合使用者直覺，系統捨棄了 UTC 轉換。
    - **儲存基準**：資料庫統一儲存 Naive Taiwan Datetime (不含時區)。
    - **序列化優化**：後端傳遞給前端的時間格式統一為 `YYYY-MM-DD HH:mm:ss` (透過 `json_response`)，確保瀏覽器在任何情況下都將其解析為「本地時間」。
    - **背景排程基準**：所有自動旅程推播時間計算均以 `get_now_taiwan()` 為基準與資料庫時間對齊。
    - **加入用戶時間同步**：加入用戶時的 `cron_table.push_time` 與 `user_project_status.updated_at` (Joined At) 均顯式由後端 Python 提供台灣時間戳記，而非透過 SQL `NOW()` 以避免因資料庫伺服器時區導致的誤差。
  - **Flex 編輯器邏輯優化**:
    - **狀態同步**：採用 functional updates 與 `key` 重掛載機制解決非同步圖片上傳定位 Bug。
    - **視覺滿版**：優化 JSON 生成邏輯，移除圖片型卡片的空區塊，實現真正的滿版外觀。
  - Resolved `ReferenceError`s caused by deprecated `showToast` calls.

### Visualization
- Uses `recharts` for LineCharts (Trend Analysis) and BarCharts (Keyword Ranking).
- Supports filtering by category (Message, Follow, User), tag selection, and group unit (Day/Week/Month/Year).
- Data export supported via CSV downloads in the global Statistics page.

## Image Upload Integration (圖片上傳整合)

### Core Components
1. **Backend Endpoint**: `/api/upload/github` in `backend/endpoints/upload.py`.
   - Uses GitHub API to upload images as base64-encoded content.
   - **CDN Integration**: Returns `jsDelivr` CDN URLs (`https://cdn.jsdelivr.net/gh/...`) instead of raw GitHub URLs to ensure compatibility with LINE Bot API (avoids 400 errors).
   - **Configuration Storage**: Settings are retrieved from `permission_settings` (OAConfig) in the `other_settings` field (JSON). This ensures configuration persistence across Docker container rebuilds.
   - Configurable fields: `token`, `repo`, `branch`, `path`.
2. **Frontend UI**:
   - **FlexMessageEditor.jsx**: Integrated upload button for carousel/single bubbles.
   - **Projects.jsx (RichMessageModal)**: Added upload button for native `ImageSendMessage` types.
   - **AdminPage.js**: Provides management UI for GitHub settings within each OA configuration.
### Rich Menu Management (圖文選單管理)
- **Frontend**: `RichMenu.jsx`.
    - Provide a list view to manage existing rich menus and aliases.
    - Features a visual editor for creating and modifying rich menu configurations.
    - Uses a canvas-based interface to define clickable areas (bounds) on a background image (scaled for preview).
    - Supports multiple action types: `message`, `uri`, `postback`, and `richmenuswitch` (for multi-page menus).
- **Backend**: `endpoints/richmenu.py`.
    - Directly proxies requests to the Line Messaging API to manage rich menus.
    - Handles metadata creation, image upload, alias management, and setting default menus.
    - Security: All requests are protected by `@token_required` and use the OA-specific `line_token` from `other_settings`.

### Broadcast Center (群發訊息中心)
- **Frontend**: `Broadcast.jsx`.
    - 3-step wizard for creating broadcats.
    - `Step 1`: Audience selection (All, Tag, ID list) with real-time estimation.
    - `Step 2`: Message composition (up to 5 bubbles, supporting Text, Image, Video, Flex).
    - `Step 3`: Delivery scheduling (Immediate or Scheduled).
- **Backend**: `endpoints/broadcast.py`.
    - Manages `broadcasts` table.
    - Integrates with `QA_bank` for message storage and `cron_table` for scheduling.
    - Audience count logic uses `Private_var` for tag/all logic and calculates coverage ratio.
    - **Stability Pattern**: Uses a top-level `ErrorBoundary` to capture rendering exceptions and provide copyable stack traces. Employs defensive rendering guards (optional chaining, default values) for all derived data (stats, message summaries) and filters null messages from legacy data sequences.

### Rule Designer (法則表設計) [2026-03-18 更新]
- **Frontend**: `RuleDesigner.jsx`. (Route: `/ruledesigner`).
    - **滿版表格編輯器 (Inline Table Editor)**: 將原本的三欄式介面重構為大表格形式。文字與基本設定欄位 (`state_in`, `content`, `note`, `state_out`, `tag`) 支援在表格列內直接點擊修改。
    - **支援之規則庫**: 統一支援 `Q_bank` (核心規則)、`AD_bank` (管理員規則) 與 `QA_bank` (回覆庫) 之管理。
    - **回應訊息彈窗 (Modal)**: 將複雜的 `msg_rpy` (回應訊息陣列) 編輯介面與即時預覽 (JourneyPreview) 抽離為獨立的彈出視窗，確保表格畫面整潔同時不失去預覽能力。
    - **儲存與刪除**: 提供單列的 `PUT`/`POST` 儲存功能與 `DELETE` 按鈕。
    - **搜尋與高亮**: 仍保留基於用戶名稱、標籤與內容的即時過濾功能。
- **Backend**: `endpoints/rule_designer.py`.
    - 統一 API 處理 CRUD。新增 `AD_bank` 之支援。自動處理資料庫的 `msg_rpy` `json[]` 陣列反序列化。
    - **自動偵錯 (Auto-Debugging)**: 在 `create_rule` 與 `update_rule` 流程中整合 `validate_rule_fields` 驗證函數。驗證項目包括：
        - `state_in` 非空檢查（Q/AD_bank）。
        - `msg_rpy` 與 `function` 不可同時為空。
        - `check` 與 `function` 欄位的 Python 語法驗證（使用 `ast.parse`，支援逗號/分號分隔多段式語法，自動略過 `<%...%>` 模板表達式）。
        - Message 類型的 `content` 非空檢查。
        - QA_bank 的 `tag` 非空檢查。
    - **獨立語法驗證端點**: `POST /validate-syntax` 接受 `code` 與 `field` 參數，供前端即時語法檢查使用。

### Database Viewer (資料庫檢視)
- **Frontend**: `DatabaseViewer.jsx`. (Route: `/dbviewer`).
    - Dynamic data browser for all public tables and views.
    - Features: Chunked loading (300 rows/step), Search, Client-side caching.
- **Backend**: `endpoints/db_viewer.py`.
    - Provides metadata (table list) and data fetching with limit/offset and search capabilities.
    - Search is implemented using `ILIKE` across text-based columns.

## Environment Specific Configurations (環境特定配置)

### yzulabuse 環境
- **資料庫修正**: 
    - `projects` 資料表已修正為具備 `project_id` SERIAL 主鍵，並設定預設 `type`。
    - `project_schedules` 與 `cron_table` 已補齊 SERIAL 主鍵 (`schedule_id` / `task_id`)，解決編輯排程時的 `null` 錯誤問題。
- **Socket 連線執行緒安全與協議優化**：為了解決高併發下的連線中斷問題，`send_socket_event` 已重構為「請求作用域 (Request-Scoped)」模式。每次調用皆會建立獨立的 Socket.IO 客戶端實例。同時優化了傳輸協議，優先使用 WebSocket 並在失敗時自動回退至 Polling，移除針對 Heroku 的強制限制，顯著提升了 `yzulabuse` 環境的通訊穩定性。
- **針對 yzulabuse 的特殊處理**：在 `yzulabuse` 環境下，系統會優先搜尋 `OAConfig.other_settings` 中的 `socket_url`。若未設定，則預設連接至 `https://yzulabuse.herokuapp.com`。此機制確保了訊息能正確路由至該環境的機器人伺服器，避免與 `5013` 環境混淆。後端 `send_socket_event` 已實作 OA Context 感知機制，確保訊息能根據 `X-OA-ID` 導往正確的機器人引擎，解決誤導向至 5013 的問題。

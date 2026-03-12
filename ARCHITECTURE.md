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
- **Rich Menu Localization**: TERMINOLOGY in the Rich Menu module is standardized to Chinese to improve usability for non-English speakers.

### UI/UX 優化與內容驗證 (UI/UX Optimization & Content Validation) [2026-03-10]
- **Loading 狀態管理**: 
    - 實作 `Projects.jsx` 中的 `pageLoading` 狀態，當切換「自動旅程」分頁或選取不同專案時，會觸發 `LoadingSpinner` 並在 API 回傳前清空舊數據。
    - 確保用戶在切換專案時，排程列表與統計數據不會出現跨專案的殘留顯示。
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
    - **WebSocket Dynamic Resolution**: `send_socket_event` resolves `bot_name` and `namespace` from `OAConfig`, defaulting to `websoc`. This ensures compatibility with both local and Heroku-hosted bot engines without hardcoding.
- **WebSocket Stability (Heroku)**: Uses single-namespace connection handshakes to avoid Heroku's multi-namespace connection failures.
- **Message Center UI Enhancements**:
  - Integrated `useToast` for reliable 5-second auto-hide notifications.
  - Implemented immediate state updates for tag addition/deletion to prevent UI lag.
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

## Environment Specific Configurations (環境特定配置)

### yzulabuse 環境
- **資料庫修正**: 
    - `projects` 資料表已修正為具備 `project_id` SERIAL 主鍵，並設定預設 `type`。
    - `project_schedules` 與 `cron_table` 已補齊 SERIAL 主鍵 (`schedule_id` / `task_id`)，解決編輯排程時的 `null` 錯誤問題。
- **Socket 連線執行緒安全與協議優化**：為了解決高併發下的連線中斷問題，`send_socket_event` 已重構為「請求作用域 (Request-Scoped)」模式。每次調用皆會建立獨立的 Socket.IO 客戶端實例。同時優化了傳輸協議，優先使用 WebSocket 並在失敗時自動回退至 Polling，移除針對 Heroku 的強制限制，顯著提升了 `yzulabuse` 環境的通訊穩定性。
- **針對 yzulabuse 的特殊處理**：在 `yzulabuse` 環境下，系統會優先搜尋 `OAConfig.other_settings` 中的 `socket_url`。若未設定，則預設連接至 `https://yzulabuse.herokuapp.com`。此機制確保了訊息能正確路由至該環境的機器人伺服器，避免與 `5013` 環境混淆。後端 `send_socket_event` 已實作 OA Context 感知機制，確保訊息能根據 `X-OA-ID` 導往正確的機器人引擎，解決誤導向至 5013 的問題。

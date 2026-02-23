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
-   **Editor Behavior**: The frontend detects this prefix to open the advanced visual editor instead of a plain text input.
-   **Image Upload**: The Flex Message Editor includes an upload button that allows users to upload images directly to a configured GitHub repository. The backend handles the GitHub API integration and returns the raw image URL.

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
  - **用戶清單搜尋 (User List Search)**:
    - 搜尋框綁定 `searchQuery` state，透過 debounce（300ms）後發送 API 請求，支援依 `user_id` 與使用者名稱搜尋。
    - 搜尋框具備即時清除按鈕（X）。
  - **標籤篩選 (Tag Filtering)**:
    - 載入所有可用標籤並顯示為可點選的標籤按鈕列表（含「全部」選項）。
    - 點選標籤後，以 `tag` query parameter 傳入 `/api/users`，僅回傳擁有該標籤的用戶。
  - **對話內容搜尋 (Message Content Search)**:
    - 聊天室上方有獨立搜尋框，可搜尋當前選用用戶的對話內容。
    - 符合的關鍵字以黃色背景高亮顯示，並顯示符合筆數。
  - **Message Display**:
    - Messages from `yzuadmin`, or with category `Sensor`, `Response`, or `sys_reply` are displayed on the right (Admin/System side).
    - `sys_reply` messages are displayed with rich content (text/image/video/audio/flex).
- **Backend**:
  - `GET /api/users`: 新增 `q`（關鍵字）和 `tag`（標籤）查詢參數。
    - **深度檢索邏輯**：`q` 參數會比對 `user_id`、姓名（Private_var），以及 `history` 表中的對話內容。
    - **QA_bank 整合**：若 `history` 內容為 QA 標籤（如 `cron|QA|...`），會自動聯結 `QA_bank` 表搜尋其對應的訊息內容（`ans` 和 `msg_rpy`），確保自動化訊息也能被搜尋。
  - `GET /history/<user_id>`: 獲取指定用戶的完整聊天紀錄。

## Data Analysis & Statistics (數據分析與統計)

### Core Components
1. **Integrated Project Metrics**: Located within `Projects.jsx` -> `activeTab === 'schedules'`.
   - Displays project-specific metrics: 觸發客戶數 (tc), 完成率 (completion_rate), 成功/失敗數 (mss/msf).
   - Metrics are filtered by the selected project and the specified date range.
2. **Global Account Analysis**: Located within `Statistics.jsx`.
   - **Trend Analysis**: Fetches data from `/api/statistics` (Global metrics: Messages, Follows, User count).
   - **Keyword Ranking**: Fetches data from `/api/statistics/keywords` (Top keyword rankings).

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

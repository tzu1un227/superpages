# Architecture Documentation

## System Overview
This project is a web application with a Flask backend and a React frontend. It manages users, projects, and scheduled events, integrating with a Socket.IO server for real-time communication.

## Scheduled Event Management (定時觸發事件)

### Core Components
1.  **Backend Processor**: `scheduled_event_processor` in `backend/app.py`.
    -   Type: Background Daemon Thread.
    -   Interval: Checks database every 10 seconds.
2.  **Database**: `scheduled_events` table (PostgreSQL).
    -   Stores event definitions, target users, message content, and execution status.
3.  **Frontend**: `ScheduledEvents.jsx` (Route: `/scheduled-events`).
    -   Provides UI for CRUD operations via `/api/scheduled-events`.
4.  **Communication**: Socket.IO Client.
    -   Connects to an external WebSocket server (default: `https://irl-svr.ee.yzu.edu.tw:5013`) to trigger events.

### Execution Logic
1.  **Polling**: The processor wakes up every 10 seconds.
2.  **Selection**: Queries `scheduled_events` for rows where:
    -   `is_enabled` is TRUE.
    -   `last_executed_at` is NULL (never executed) OR (`last_executed_at` + `interval_hours` <= Current Time).
3.  **Trigger**:
    -   Connects to the Socket.IO server.
    -   Emits a message event (`websoc_message`) to the namespace `/{BOT_NAME}`.
    -   Payload includes: `user` (target_id), `message`, `type`, and `api_index`.
4.  **Update**: Sets `last_executed_at` to the current timestamp to schedule the next run.

### Project Schedules (Different from Scheduled Events)
-   Managed via `/api/schedules`.
-   Stored in `project_schedules` table.
-   *Note: No active background execution loop was found in `app.py` for this table. It may be used by external scripts or is a passive configuration.*

### Rich Message Handling
-   **QA Integration**: Messages can be stored as complex structures (Flex, Image, etc.) in the `qa_bank` table.
-   **Reference Protocol**: In `project_schedules` or other text fields, these are referenced using the `QA|` prefix followed by the unique tag (e.g., `QA|cron_project_step`).
-   **Editor Behavior**: The frontend detects this prefix to open the advanced visual editor instead of a plain text input.

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
  - **Message Display**:
    - Messages from `yzuadmin`, or with category `Sensor`, `Response`, or `sys_reply` are displayed on the right (Admin/System side).
    - `sys_reply` messages are displayed with raw content, without type indicators.
- **Backend**: `/api/history/<user_id>` fetches chat history from `history:{app_id}` table.

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

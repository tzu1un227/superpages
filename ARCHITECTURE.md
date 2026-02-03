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

# Architecture

## System Overview
The Superpages application is a full-stack web application designed for managing automation schedules, broadcasting messages, and monitoring system statuses. It integrates with a PostgreSQL database and uses Socket.IO for real-time communication.

## Frontend
- **Framework**: React
- **Routing**: React Router
- **State Management**: React Context (`AuthContext`) + Local State
- **UI Components**: Custom components with specific CSS styling. Uses `lucide-react` for icons.
- **Key Pages**:
    - `Projects.jsx`: Main interface for Project and Schedule management.
    - `Broadcast.jsx`: Message broadcasting.
    - `ScheduledEvents.jsx`: Recurring event management.
    - `Statistics.jsx`: Data visualization.

## Backend
- **Framework**: Flask (Python)
- **Database ORM**: SQLAlchemy (for Metadata like Users, Pages) & Raw `psycopg2` for business data.
- **Authentication**: Google OAuth + JWT.
- **Real-time**: Flask-SocketIO (client mode used for triggering external bots).
- **Background Tasks**: Python `threading` for `scheduled_event_processor`.

## Database Schema (Key Tables)
- **projects**: Stores automation project definitions (start/end time, status, configuration).
- **project_schedules**: JSON/Relation mapping for steps within a project.
- **scheduled_events**: Standalone recurring events.
- **users**: System administrators and authorized users.
- **OAConfig**: Configuration for different Official Accounts (OA) managed by the system.

## Data Flow
1. **User Interaction**: User configures a project in `Projects.jsx`.
2. **API Call**: Frontend sends POST/PUT requests to `/api/projects` or `/api/schedules`.
3. **Storage**: Backend validates and stores data in PostgreSQL.
4. **Execution**:
    - **Projects**: (Logic implementation details implied) likely polled or triggered by external scripts reading the DB.
    - **Scheduled Events**: Internal background thread checks `scheduled_events` table and emits Socket.IO events when due.

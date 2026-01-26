# Superpages 專案架構文件

本文件旨在說明 Superpages 系統的技術架構、核心功能模組以及部署配置。

## 1. 專案概述

Superpages 是一個整合 LINE 官方帳號管理的後台系統，提供數據分析、即時對話、群發訊息以及自動化推播專案管理功能。
系統支援 **多官方帳號 (Multi-OA)** 管理，允許單一用戶切換不同帳號以管理不同資料庫的數據。

---

## 2. 技術棧 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: React (Vite 建立)
- **UI 組件庫**: Vanilla CSS, Lucide React (圖示), Material UI (MUI - 用於 Admin/Login)
- **數據可視化**: Recharts (圖表繪製)
- **API 請求**: Axios / Fetch Wrapper
- **路由管理**: React Router DOM (支援動態 OA 路由)
- **身分驗證**: Google OAuth 2.0 (@react-oauth/google)

### 後端 (Backend)
- **核心框架**: Flask (Python)
- **資料庫**: 
    - PostgreSQL (業務數據 - 每個 OA 可對應不同資料庫)
    - SQLite (系統權限與使用者資料 - `meta_data.db`)
    - ORM: SQLAlchemy (用於 SQLite)
- **即時通訊**: Socket.IO (透過 python-socketio 行為觸發)
- **資料庫驅動**: Psycopg2 (用於 PostgreSQL)

### 部署 (Deployment)
- **容器化**: Docker, Docker Compose

---

## 3. 前端架構 (Frontend Architecture)

前端採用單頁應用程式 (SPA) 架構，主要包含以下頁面及功能：

### 核心路由結構
- `/login`: 登入頁面
- `/admin`: 系統管理員頁面 (管理使用者與 OA 設定)
- `/oa/:oaId/dashboard`: 特定 OA 的儀表板
- `/oa/:oaId/message-center`: 特定 OA 的訊息中心
- `/oa/:oaId/projects`: 特定 OA 的專案管理
- ... (其他功能頁面均掛載於 `/oa/:oaId/` 下)

### 核心頁面功能詳述

#### 1. 登入與權限 (`Login.jsx` & `AuthContext`)
- **Google 登入**: 整合 Google Sign-In，驗證成功後交換 JWT Token。
- **權限控管**: 
    - 系統將用戶分為 `admin` (管理員) 與 `user` (一般用戶)。
    - `AuthContext` 負責全域狀態管理，並根據角色動態顯示側邊欄選單。
    - **OA Context**: 登入後自動取得用戶可存取的 OA 列表，並生成對應的選單。

#### 2. 管理員後台 (`AdminPage.jsx`)
- **用戶管理**: 
    - 檢視所有系統用戶。
    - 設定用戶角色 (Admin/User)。
    - 分配用戶可存取的官方帳號 (OA Configs)。
- **OA 設定管理**: 
    - 新增或修改 Official Account 的連線資訊 (DB URL) 與對應頁面。

#### 3. 綜合數據 (`Statistics.jsx`)
- **看板摘要**: 顯示「總客戶數 (follow)」、「有效好友數 (user)」及「總訊息量 (message)」的總量統計。
- **趨勢分析圖**: 使用 Line Chart 視覺化顯示各項指標隨時間變化的趨勢。

#### 4. 訊息中心 (`MessageCenter.jsx`)
- **用戶列表**: 側邊欄列出所有與系統互動過的用戶 ID。
- **即時對話介面**: 管理者可在此直接發送訊息給用戶。

#### 5. 專案與排程管理 (`Projects.jsx`)
- **分頁式介面**: 將「專案管理」與「排程設定」整合於同一頁面切換。

#### 6. 群發訊息 (`Broadcast.jsx`)
- 支援全體發送、標籤受眾、指定 ID 列表三種模式。

#### 7. 獎品查詢 (`PrizeStatus.jsx`)
- **獎品清單**: 顯示 `ticket_table` 中的獎品名稱與中獎者 ID。

---

## 4. 後端架構 (Backend Architecture)

後端主要負責 API 提供與資料庫互動，其核心邏輯位於 `app.py`：

- **動態資料庫連線 (Dynamic DB Connection)**:
    - 透過 Header `X-OA-ID` 識別當前請求針對的官方帳號。
    - Middleware 驗證用戶權限後，動態切換 `psycopg2` 連線至該 OA 設定的 `db_url`。

- **API 路由**: 
    - `/api/auth/google-login`: Google Token 驗證與 JWT 發放。
    - `/api/admin`: 管理員專用接口 (Users, OA Configs CRUD)。
    - `/api/my_oas`: 取得當前用戶被授權存取的 OA 列表 (包含 Page 權限)。
    - 一般業務 API (`/api/projects`, `/api/statistics` 等) 均需在 Header 帶入 OA ID。

---

## 5. 資料庫設計 (Database Design)

主要涉及的資料表：

**PostgreSQL (業務數據 - 每一個 OA 一個 DB)**:
- `projects`: 儲存推播專案資訊。
- `project_schedules`: 儲存專案下的各個推播階段設定。
- `history:5013` (或其他後綴): 儲存訊息與事件記錄。
- `Private_var:5013`: 儲存用戶的標籤 (Tag)。
- `ticket_table`: 儲存獎品資訊。

**SQLite (Meta Data - 系統全域)**:
- `users`: 系統使用者 (Email, Role, Allowed OAs)。
- `pages`: 系統頁面定義 (Name, Description)。
- `oa_configs`: 官方帳號設定 (OA Name, DB URL, Page IDs)。

---

## 6. 部署配置 (Deployment)

使用 `docker-compose.yml` 進行服務編排：
- **Backend Service**: 執行於 Port 5000，映射至主機 9017。
- **Frontend Service**: 執行於 Nginx 並映射至主機 9016。

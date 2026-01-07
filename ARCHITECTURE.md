# Superpages 專案架構文件

本文件旨在說明 Superpages 系統的技術架構、核心功能模組以及部署配置。

## 1. 專案概述

Superpages 是一個整合 LINE 官方帳號管理的後台系統，提供數據分析、即時對話、群發訊息以及自動化推播專案管理功能。

---

## 2. 技術棧 (Tech Stack)

### 前端 (Frontend)
- **核心框架**: React (Vite 建立)
- **UI 組件庫**: Vanilla CSS, Lucide React (圖示)
- **數據可視化**: Recharts (圖表繪製)
- **API 請求**: Axios
- **路由管理**: React Router DOM

### 後端 (Backend)
- **核心框架**: Flask (Python)
- **資料庫**: PostgreSQL
- **即時通訊**: Socket.IO (透過 python-socketio 行為觸發)
- **資料庫驅動**: Psycopg2

### 部署 (Deployment)
- **容器化**: Docker, Docker Compose

---

## 3. 前端架構 (Frontend Architecture)

前端採用單頁應用程式 (SPA) 架構，主要包含以下頁面及功能：

### 核心頁面功能詳述

#### 1. 登入頁面 (`Login.jsx`)
- 提供基礎的身分驗證介面。
- 登入成功後將用戶資訊儲存於 `localStorage` 並提供全局授權狀態。

#### 2. 綜合數據 (`Statistics.jsx`)
- **看板摘要**: 顯示「總客戶數 (follow)」、「有效好友數 (user)」及「總訊息量 (message)」的總量統計。
- **趨勢分析圖**: 使用 Line Chart 視覺化顯示各項指標隨時間變化的趨勢。
- **動態過濾**:
    - 支援選取不同的統計指標（訊息量、客戶數等）。
    - 支援時間範圍選取與統計單位切換（日、週、月、年）。
    - 提供「標籤過濾」功能，可動態在圖表上顯示或隱藏特定標籤的資料線。
- **詳細數據清單**: 以表格形式列出具體的時間、標籤與數值。

#### 3. 訊息中心 (`MessageCenter.jsx`)
- **用戶列表**: 側邊欄列出所有與系統互動過的用戶 ID，並顯示最後一則訊息與時間。
- **即時對話介面**:
    - 顯示特定用戶的歷史訊息記錄（`/api/history/${userId}`）。
    - 管理者可在此直接發送訊息給用戶（指令：`MSG|content`）。
- **標籤管理**:
    - 可針對個別用戶新增或刪除標籤（指令：`set_tag` / `del_tag`）。
    - 標籤即時同步顯示於對話標頭。

#### 4. 專案與排程管理 (`Projects.jsx`)
- **分頁式介面**: 將「專案管理」與「排程設定」整合於同一頁面切換。
- **專案管理 (Projects)**: 
    - 建立自動化推播專案。
    - 設定專案名稱、有效起迄時間以及是否啟用。
- **排程管理 (Schedules)**:
    - 針對特定專案設定「推播步驟」。
    - 定義每個步驟的「觸發間隔時間 (小時)」以及「預設訊息內容」。
    - 提供按專案過濾排程的功能。

#### 5. 群發訊息 (`Broadcast.jsx`)
- 支援三種群發對象模式：
    - **全體發送**: 向所有關聯用戶發送。
    - **標籤受眾**: 針對特定標籤（如：VIP、新客戶）的群體發送。
    - **指定 ID 列表**: 直接輸入 User ID 名單進行發送。
- 透過轉發指令至 Socket.IO 伺服器來驅動手機端的發送行為。

---

## 4. 後端架構 (Backend Architecture)

後端主要負責 API 提供與資料庫互動，其核心邏輯位於 `app.py`：

- **API 路由**: 
    - `/api/projects`: 專案之 CRUD。
    - `/api/schedules`: 排程之 CRUD。
    - `/api/statistics`: 呼叫 DB Function 獲取彙整後的統計數據。
    - `/api/history/<user_id>`: 查詢與特定用戶的歷史訊息。
    - `/api/users`: 取得互動用戶列表及其最新狀態。
    - `/api/trigger`: 核心觸發介面，透過 Socket.IO 將管理端的指令發送至外部處理伺服器（如手機端或機器人）。
- **資料庫整合**: 使用 `psycopg2` 直接操作 PostgreSQL，並利用 `RealDictCursor` 簡化 JSON 回傳處理。

---

## 5. 資料庫設計 (Database Design)

主要涉及的資料表：
- `projects`: 儲存推播專案資訊 (ID, Name, Date Range, Status)。
- `project_schedules`: 儲存專案下的各個推播階段設定 (Interval, Content)。
- `history:5013`: 儲存訊息與事件記錄。
- `Private_var:5013`: 儲存用戶的標籤 (Tag) 等私有變量資訊。

---

## 6. 部署配置 (Deployment)

使用 `docker-compose.yml` 進行服務編排：
- **Backend Service**: 執行於 Port 5000，映射至主機 9017。
- **Frontend Service**: 執行於 Nginx 並映射至主機 9016。
- 前端與後端透過 Docker 網路進行通訊，前端配置 `depends_on` 確保後端先行啟動。

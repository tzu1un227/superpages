# CHANGELOG

## [2026-01-07]

### Added
- 建立 `docs` 資料夾並將 `ARCHITECTURE.md` 移入。
- 建立 `CHANGELOG.md` 用於紀錄專案變更。
- **專案參與用戶**:
    - 後端新增 `/api/projects/<id>/users` 接口，從 `cron_table` 取得參與用戶。
    - 前端 `Projects.jsx` 新增「參與用戶」分頁，可查看各專案的使用者。
    - 新增「手動加入用戶」按鈕，觸發 `iup|{project_id}` 指令。
- **定時觸發事件**:
    - 資料庫新增 `scheduled_events` 資料表（支援 `interval_hours` 與 `last_executed_at`）。
    - 後端實作背景執行緒，根據設定之「隔多久觸發一次 (小時)」自動計算並執行。
    - 前端新增「定時觸發」頁面，支援設定間隔時間與查看最後執行紀錄。
- **獎品查詢頁面**:
    - 後端新增 `/api/tickets` 接口，從 `ticket_table` 取得獎品中獎狀況。
    - 前端新增 `PrizeStatus.jsx` 頁面，顯示獎品與中獎者 ID。
    - 提供遊戲控制按鈕（啟動、抽大獎、關閉、捐出、新增），並整合 Socket.io 觸發指令。

### Documentation
- 重整文件架構。

## [2026-01-21]

### Added
- **Google 登入與權限管理**:
    - 後端整合 `Google Sign-In` 與 `JWT` 驗證。
    - 後端導入 `SQLAlchemy` 並建立 `User`, `Page`, `OAConfig` 模型 (使用 SQLite `meta_data.db` 儲存)。
    - 新增 `/api/admin` 相關接口，用於管理用戶權限與 OA 設定。
- **前端新功能**:
    - 新增 `Login.jsx`: 支援 Google 登入。
    - 新增 `AdminPage.jsx`: 提供管理員專用的後台介面，可設定用戶權限與連結 OA。
    - 新增 `AuthContext`: 全局登入狀態與權限控管。
    - 路由保護: 導入 `ProtectedRoute` 與 `AdminRoute` 確保頁面存取安全。

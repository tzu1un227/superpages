# CHANGELOG

## [2026-01-29]

### Changed - UI/UX Improvements
- **專案與排程管理 (Project & Schedule Management)**:
    - **導覽優化**: 點擊專案列表中的專案名稱可直接跳轉至排程頁面並自動過濾該專案。
    - **排程列表**: 新增排程總數統計顯示。
    - **輸入介面調整**: 
        - 修正並加大「間隔時間」輸入框寬度，確保數值清晰可見。
        - 修正「分鐘」無法調整的問題。
        - 加大「儲存/取消」按鈕寬度以利點擊。
    - **視覺簡化**: 
        - 隱藏表格中的 Database ID 欄位。
        - 隱藏 Rich Message 的 `QA|` 前綴標籤，介面更清爽。
    - **Bug Fix**: 
        - 修正專案名稱可為空的錯誤，新增必填驗證。
        - 修正新增排程時，直接輸入的文字訊息未能正確傳遞至進階編輯器的問題。

## [2026-01-27]

### Changed
- **排程設定 (Schedule Settings)**:
    - **UI 改良**: 在新增與編輯排程時，「間隔時間」欄位由原本的單一輸入框改為「天」、「時」、「分」三個獨立的整數輸入框。
    - **顯示優化**: 排程列表中的間隔時間顯示格式改為 "X天 Y小時 Z分"。
    - 此變更保持後端資料格式 (Total Hours) 不變，僅在前端進行轉換，確保與舊有資料的相容性。

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

## [2026-01-23]

### Changed
- **專案與排程管理 (Projects)**:
    - **狀態邏輯更新**: 專案狀態細分為 編輯中、已排程、進行中、已暫停、已完成、已終止，並由後端依據時間與啟用狀態自動計算。
    - **新增錨點設定 (Anchor Setting)**: 支援「立即觸發」與「每週特定時間 (如週六 18:00)」觸發。
    - **新增休眠時間 (Dormancy Time)**: 可設定每日不發送訊息的時段 (如 23:00~08:00)。
    - **資料庫變更**: `projects` 資料表新增 `anchor_config` 與 `dormancy_config` 欄位 (JSONB)。


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

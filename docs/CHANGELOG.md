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

### Documentation
- 重整文件架構。

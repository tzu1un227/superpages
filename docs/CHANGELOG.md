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
    - 資料庫新增 `scheduled_events` 資料表。
    - 後端實作背景執行緒，每 10 秒檢查並執行到期的定時事件。
    - 前端新增「定時觸發」頁面，支援多個事件同時計算與管理。

### Documentation
- 重整文件架構。

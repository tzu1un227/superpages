# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- **用戶標註功能 (User Tagging)**: 在 Flex 訊息編輯器中新增「標籤」欄位，支援按鈕與圖片行為中的用戶標註。開發了 `TagInput` 元件提供自動完成與多選功能。
- **QA_bank 修正 (QA_bank Fix)**: 修正新增排程時 `QA_bank` 的 `io` 欄位未正確填入 `Output` 的問題。現在不論是新增、更新或匯入排程，系統均會確保相關標籤的 `io` 屬性正確設定為 `Output`，並初始化必要欄位。
- **統計數據修正 (Statistics Fix)**: 修復「重啟用戶進度」時未同步更新「總觸發次數」的問題。修正了後端 ID 辨別錯誤（OA 設定 ID 與資料庫名稱之混淆），並移除冗餘的觸發計數邏輯，解決了手動加入用戶時數據重複累計 (Double Counting) 的問題，確保完成率計算準確。
- **專案清理 (Codebase Cleanup)**: 清理了根目錄與後端目錄中超過 30 個開發期間產生的臨時偵錯、測試與遷移腳本，提升程式碼庫的可維護性。
- **穩定性修復 (Frontend Stability)**: 修正專案管理頁面進入「排程設定」時可能導致的黑畫面當機。對所有 `.map()` 呼叫加入陣列檢查，防止非陣列資料導致錯誤。
- **排程可見性修復 (Schedule Visibility)**: 修正「排程設定」看不到排程的問題。改進前端 `fetchSchedules` 的資料型態處理與錯誤捕捉，並在後端 `get_schedules` 加入更多防護與日誌記錄。
- **穩定性修復 (Frontend Fix)**: 修正 `formatInterval` 回傳格式，確保解構賦值的正確性。
- **穩定性修復 (Frontend Fix)**: 修正排程列表在解析 `message_content` 時，若缺少分隔符號可能導致的 `pop()` 呼叫錯誤。
- **後端穩定性 (Backend Stability)**: 修正儲存問答銀行 (QA) 時可能發生的 500 錯誤。改進資料庫 `msg_rpy` 欄位處理邏輯，支援 Postgres 的 `json[]` 陣列格式。
- **後端改進 (Backend Improvement)**: 改進 `get_schedules` 邏輯，當訊息預覽無法讀取或發生錯誤時提供預設提示文字。
- **Statistics Fix**: Corrected API parameter names in `Projects.jsx` (`start_time` -> `start_date`) to correctly fetch project statistics. [2026-02-09]
- **GitHub CDN Fix**: Switched image upload return URL from `raw.githubusercontent.com` to `cdn.jsdelivr.net` to resolve LINE Bot API 400 errors. [2026-02-09]
- **Native Image Upload**: Added support for uploading images to GitHub directly from native "Image Message" types in the Advanced Message Editor.
- **Persistent GitHub Configuration**: Migrated GitHub upload settings from `.env` to the database (OA Config). Added management UI in the Admin Page to allow per-OA configuration, ensuring settings persist in Docker environments.
- **Image Upload to GitHub**: Added ability to upload images directly to GitHub from the Flex Message Editor in Schedule Settings.
- **Statistics Integration**: Consolidated standalone statistics functionality into the `Projects.jsx` page. Global statistics (Trends, Keywords) are now visible by default in the "stats" tab when no project is selected, alongside project-specific metrics. Removed the redundant `Statistics.jsx` page and associated route from `App.jsx`.
- **Project Import Isolation Fix**: Resolved issue where different projects shared the same message tags. Each project now gets unique cloned tags during import.
- **Flex Message Editor Stability**: Fixed oscillating template states and UI flickers using semantic normalization and initialization guards.
- **Flex Message Editor Fix**: Improved auto-save reliability to prevent infinite loops.
- **Improved Project Page UI**: Replaced CSS Grid with Flexbox in "Add Project" form to prevent overlapping of fields at high zoom levels (150%+), ensuring a responsive layout.
- Fixed bug in Advanced Message Editor: Prevented overwriting of QA tag with preview text during schedule editing, ensuring saved Rich Messages can be correctly reloading and edited.
- Improved Lottery Management: Added "Registered Users" tab to display user list (Name + Avatar).
- Improved Lottery Management: Game status and ticket list now automatically refresh after actions (e.g., Start Game).
- Added Game Status display in Lottery Management (抽獎管理).
- Added functionality to delete prizes (tickets) in Lottery Management.
- Added new backend endpoints: `GET /api/game-status` and `DELETE /api/tickets/<id>`.
- Improved Message Center UI: `sys_reply` messages are now right-aligned and display only content without filters.
- **Improved Project Management**: "Manual Participants" list now correctly fetches users with name and picture from `Private_var` instead of `person_table`.
- **Improved Message Center**: `sys_reply` messages containing JSON (e.g., `{"text": "...", "type": "..."}`) are now parsed to display only the text content in Traditional Chinese.
- **Improved Message Center**: Enhanced Tag Input to support selecting existing tags (via dropdown) or entering new ones, and increased input width for better usability.
- **Improved Message Center**: Tags (both in display and dropdown menu) are now displayed without surrounding brackets or quotes (e.g., `['tag']` becomes `tag`), ensuring cleaner UI.
- **Improved Lottery Management**: "Registered Users" list now fetches from `person_table` and displays only the user's name, providing a cleaner view for lottery purposes.
- **Improved Message Center**: `sys_reply` messages can now display images, videos, audio, and simplified Flex messages (instead of raw JSON text), providing a better preview of bot responses.
- **Scheduler Refactor**: Replaced `scheduled_events` with `cron_table` based scheduling. All scheduled tasks are now handled within Projects, supporting multi-step and recurring workflows. [2026-02-09]
- **Backend Stability**: Fixed "Working outside of application context" errors in background threads by ensuring strict context usage in `cron_scheduler_processor`.
- **Backend Cleanup**: Removed deprecated `scheduled_events` table and endpoints.
- **Backend**: `/api/history/<user_id>` fetches chat history from `history:{app_id}` table.
- Initial creation of CHANGELOG.md and ARCHITECTURE.md.

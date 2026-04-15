# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- **修復 Questionnaire 建立與編輯畫面程式碼層級錯誤 (Questionnaire Parsing Fix)** [2026-04-15]:
  - **修復語法無法解析崩潰**：解決了 `Questionnaire.jsx` 中因為開發過程片段複製錯誤 (將元件狀態與 UI HTML 重複貼上至 `QuestionCard` 內部) 導致前端在建置與執行期拋出 `Unexpected closing "Box" tag` 與 `Expected ";"` 的致命 Syntax Error。移除了高達 280 行的不明錯置片段，正確復原 `QuestionCard` 的結尾。
- **「權限設定」表單驗證優化 (OA Config Validation UX)** [2026-04-14]:
  - **全欄位必填化**：將 OA 設定中的所有輸入項（包括 GitHub 與 LINE 設定）改為必填，確保系統功能不因配置缺失而失效。
  - **延遲顯著提示**：實現了新的 UI 交互邏輯，平時不顯示錯誤紅框，僅在點擊儲存且有漏填時才一併標記，提供更精確且不干擾的引導。

- **群發功能穩定性與效能優化 (Broadcast Stability & Performance)** [2026-04-14]:
  - **解決轉圈圈問題**：修正了 `list_broadcasts` 中的時區比較 Bug (TypeError)，恢復清單顯示的流暢性。
  - **RDS 資料表自動化**：實現了 `ensure_rds_tables` 機制，系統現在會根據 `app_name` 自動建立缺失的 `broadcasts` 與 `cron_table` 資料表，確保新帳號即開即用。
  - **強化連線穩定性**：為外部資料庫連線加入了 `connect_timeout` 設定，防止因網路不穩導致的「Network Error」或網頁懸掛。
  - **效能提升**：持續採用批量插入 (`Bulk Insert`) 優化大規模受眾的排程速度。

- **權限與資料隔離強化 (Permission & Data Isolation Enforcement)** [2026-04-14]:
  - **強制設定 App Name**：因應 RDS 多租戶架構，現在在「權限設定」中新增或編輯 OA Config 時，必須填寫 `App Name` (資料表後綴)。
  - **後端驗證攔截**：API 已實作請求檢查，若 `other_settings.app_name` 為空則回傳 400 提示訊息，防止資料隔離失效。
  - **前端 UI 提示**：在管理介面中將該欄位標記為必填，並加入錯誤狀態顯示與儲存前的二次檢查。

- **訊息中心優化 (Message Center Improvements)** [2026-04-13]:
  - **修復列表跳動問題**：在後端用戶列表查詢中引入第二排序基準，確保穩定排序，解決偶發性的 UI 位置閃爍。
  - **訊息中心標籤同步邏輯調整 (Message Center Tag Sync Logic Adjustment)** [2026-04-10]:
    - **邏輯變更**：移除新增與刪除標籤時的「樂觀更新」機制。現在系統會等待 API 操作完成後才更新介面。
    - **提示優化**：將標籤刪除提示語由「已刪除」改為「刪除中」，以匹配後端同步的穩定護欄機制。
  - **自動旅程功能與時區修復 (Journey & Timezone Fixes)** [2026-04-10]:
    - **修復 8 小時偏差**：解決專案開始時間與預計推送時間偏差 8 小時的問題。系統現在會正確將本地時間轉為 UTC 儲存。
    - **統計日期校正**：確保每日統計數據（如 ms, mss）是以台灣時間日期為準。
    - **用戶列表優化**：當狀態為「已完成」時目前步驟顯示「旅程完成」。
    - **時間基準修正**：加入用戶進入尚未開始的旅程時，間隔基準改為從「旅程開始時間」起算，避免過早推播。
  - **Flex 訊息功能修復與優化 (Flex Feature Fixes & Optimizations)** [2026-04-10]:
    - **輪播上傳定位修復**：修正輪播模式下圖片上傳定位錯誤的問題 (Targeting Fix)。
    - **輪播圖片滿版優化**：修正圖片型卡片在混合輪播中出現白色區塊的問題，實現真正的滿版視覺效果。
  - **自動旅程操作完成通知 (Projects CRUD Toast Notifications)** [2026-04-10]:
    - 在自動旅程管理頁面的新增、編輯、刪除旅程及排程步驟操作完成後，加入 `showToast` 成功通知，讓使用者即時得知操作結果。
  - **綜合數據關鍵字排行標籤篩選 (Keyword Ranking Tag Filter)** [2026-04-10]:
    - 在綜合數據頁面的「用戶熱門關鍵字」區塊新增標籤篩選功能，透過 `/api/tags` 取得所有可用標籤，並以 pill 樣式的篩選按鈕呈現。
    - 選擇特定標籤後，系統會帶上 `tag` 參數重新呼叫 `/api/statistics/keywords` API，僅顯示該標籤用戶的關鍵字排行。
  - **綜合數據擴充與優化 (Statistics & Quota Management)** [2026-04-08]:
    - **推播用量查詢**：在 `Statistics.jsx` 大數據面板新增「本月推播用量」指標，透過串接 LINE Official Account API (`/v2/bot/message/quota/consumption`) 提供客戶最直接的付費/免費訊息消耗總量 (`totalUsage`)，方便掌控額度。
    - **載入骨架屏 (Skeleton)**：優化了綜合數據在載入期間的生硬畫面，將切換日期時出現的「0」字樣改為動態灰色脈衝骨架，提升視覺預期感。
  - **群發訊息防呆與崩潰根除 (Broadcast Mod Fixes)** [2026-04-08]:
    - **強大錯誤邊界 (Robust Error Boundary)**：在 `Broadcast.jsx` 導入了專用的 `ErrorBoundary` 類別。當 React 渲染發生崩潰（例如資料庫中的舊訊息格式不相容）時，會彈出一個深紅色的自定義錯誤介面，並列出詳細的「錯誤追蹤碼 (Error Stack)」。使用者可以直接點擊「複製錯誤資訊」按鍵來協助回報，解決了過去直接「黑畫面」無法除錯的問題。
    - **全方位防禦性渲染 (Defensive Rendering Guards)**：修正了 `isViewOnly` 變數在巢狀渲染函數中引發的 `ReferenceError`。我們將狀態檢查改為行內計算 (Inline logic)，確保所有編輯器按鈕與輸入框在「已發送」任務下都能正確鎖定為唯讀狀態。
    - **已發送任務嚴格唯讀機制 (Read-Only Sent Tasks)**：補足了過去在群發訊息中，「已發送」的任務在點擊查看進入第一步驟時，依然能變更發送對象與標籤的漏洞。現在系統全面將所有已發送任務的第一步驟（發送對象、標籤與人員搜尋）、第二步驟（編輯訊息內容與按鈕）鎖定為唯讀狀態，確保所有歷史發送紀錄絕對無法被意外竄改。
    - **第二步驟全黑畫面崩潰 (Step 2 Null Exception Fix)**：這一次，我們抓到了藏在 React 渲染引擎中的元凶。這並不是 Flex JSON 的錯誤，而是由資料庫反反覆覆解析回來的舊資料 (`msg_rpy`) 中，有時存在著單個 `null` 的「空序列」殘留，導致 React 前端邏輯在遍歷迴圈並讀取 `msg.OTYPE` 時觸發了致命的 `TypeError` 當機。我們在 `Broadcast.jsx` 的渲染迴圈中植入了強制的空序列過濾 `if (!msg) return null;`，正式根絕因為單個訊息損毀而導致網頁完全黑屏被關閉的無妄之災。
  - **Flex 編輯器與預覽引擎全面升級 (Flex Editor & Journey Preview UI)** [2026-04-08]:
    - **版面重構**：將 `FlexMessageEditor.jsx` 原先在左側填表、右側受限尺寸 (`380px`) 預覽的雙欄設計，重構為「上下堆疊」的寬版介面。編輯表單置頂，即時預覽置底並自動釋放畫面寬度，解決過去預覽 Flex 畫面倒置過小不易閱讀的詬病。
    - **安全渲染引擎機制 (Safe Render Guard)**：深入強固了 `JourneyPreview.jsx` 中解析 Flex 訊息的每一層邏輯 (確保 Carousel / Bubble 型別對外來未規範 JSON 的抵禦)。針對陳舊、未定義、甚至陣列錯亂的卡片，均實作即時 try-catch 與型別驗證，根絕了使用者點擊「檢視群發內容」時因非同步渲染失敗導致的「全白/全黑畫面崩潰」災情。

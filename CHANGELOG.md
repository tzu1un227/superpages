# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
  - **訊息中心標籤同步邏輯調整 (Message Center Tag Sync Logic Adjustment)** [2026-04-10]:
    - **邏輯變更**：移除新增與刪除標籤時的「樂觀更新」機制。現在系統會等待 API 操作完成後才更新介面。
    - **穩定性維持**：保留 10 秒時間戳記護欄，確保在後續的伺服器輪詢中不會因後端同步延遲而導致標籤閃爍。
  - **自動旅程功能優化 (Automated Journey Enhancements)** [2026-04-10]:
    - **用戶列表優化**：當狀態為「已完成」時目前步驟顯示「旅程完成」。
    - **時間基準修正**：加入用戶進入尚未開始的旅程時，間隔基準改為從「旅程開始時間」起算，避免過早推播。
  - **Flex 訊息功能與視覺美化 (Flex Feature & Visual Fixes)** [2026-04-10]:
    - **輪播圖片白塊修復**：修正了輪播中圖片型卡片出現多餘白色區域的問題。優化了 JSON 產生邏輯與預覽器渲染邏輯。
  - **自動旅程操作完成通知 (Projects CRUD Toast Notifications)** [2026-04-10]:
    - 在自動旅程管理頁面的新增、編輯、刪除旅程及排程步驟操作完成後，加入 `showToast` 成功通知，讓使用者即時得知操作結果。
  - **綜合數據關鍵字排行標籤篩選 (Keyword Ranking Tag Filter)** [2026-04-10]:
    - 在綜合數據頁面的「用戶熱門關鍵字」區塊新增標籤篩選功能，透過 `/api/tags` 取得所有可用標籤，並以 pill 樣式的篩選按鈕呈現。
    - 選擇特定標籤後，系統會帶上 `tag` 參數重新呼叫 `/api/statistics/keywords` API，僅顯示該標籤用戶的關鍵字排行。
    - 關鍵字資料擷取從 `fetchStats` 中獨立抽出為 `fetchKeywords`，實現標籤切換時的獨立重新載入，不影響趨勢圖表。
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

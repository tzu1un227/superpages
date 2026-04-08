# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
  - **綜合數據擴充與優化 (Statistics & Quota Management)** [2026-04-08]:
    - **推播用量查詢**：在 `Statistics.jsx` 大數據面板新增「本月推播用量」指標，透過串接 LINE Official Account API (`/v2/bot/message/quota/consumption`) 提供客戶最直接的付費/免費訊息消耗總量 (`totalUsage`)，方便掌控額度。
    - **載入骨架屏 (Skeleton)**：優化了綜合數據在載入期間的生硬畫面，將切換日期時出現的「0」字樣改為動態灰色脈衝骨架，提升視覺預期感。
  - **群發訊息防呆與崩潰根除 (Broadcast Mod Fixes)** [2026-04-08]:
    - **強大錯誤邊界 (Robust Error Boundary)**：在 `Broadcast.jsx` 導入了專用的 `ErrorBoundary` 類別。當 React 渲染發生崩潰（例如資料庫中的舊訊息格式不相容）時，會彈出一個深紅色的自定義錯誤介面，並列出詳細的「錯誤追蹤碼 (Error Stack)」。使用者可以直接點擊「複製錯誤資訊」按鍵來協助回報，解決了過去直接「黑畫面」無法除錯的問題。
    - **全方位防禦性渲染 (Defensive Rendering Guards)**：針對所有 `.toLocaleString()`、`.map()`、`.length` 等呼叫實施了全域防漏檢查（如 `(stats?.count || 0).toLocaleString()`），確保即便 API 回傳資料不完整，前端介面也能優雅降級而不導致整個頁面當機。
    - **已發送任務嚴格唯讀機制 (Read-Only Sent Tasks)**：補足了過去在群發訊息中，「已發送」的任務在點擊查看進入第一步驟時，依然能變更發送對象與標籤的漏洞。現在系統全面將所有已發送任務的第一步驟（發送對象、標籤與人員搜尋）、第二步驟（編輯訊息內容與按鈕）鎖定為唯讀狀態，確保所有歷史發送紀錄絕對無法被意外竄改。
    - **第二步驟全黑畫面崩潰 (Step 2 Null Exception Fix)**：這一次，我們抓到了藏在 React 渲染引擎中的元凶。這並不是 Flex JSON 的錯誤，而是由資料庫反反覆覆解析回來的舊資料 (`msg_rpy`) 中，有時存在著單個 `null` 的「空序列」殘留，導致 React 前端邏輯在遍歷迴圈並讀取 `msg.OTYPE` 時觸發了致命的 `TypeError` 當機。我們在 `Broadcast.jsx` 的渲染迴圈中植入了強制的空序列過濾 `if (!msg) return null;`，正式根絕因為單個訊息損毀而導致網頁完全黑屏被關閉的無妄之災。
  - **Flex 編輯器與預覽引擎全面升級 (Flex Editor & Journey Preview UI)** [2026-04-08]:
    - **版面重構**：將 `FlexMessageEditor.jsx` 原先在左側填表、右側受限尺寸 (`380px`) 預覽的雙欄設計，重構為「上下堆疊」的寬版介面。編輯表單置頂，即時預覽置底並自動釋放畫面寬度，解決過去預覽 Flex 畫面倒置過小不易閱讀的詬病。
    - **安全渲染引擎機制 (Safe Render Guard)**：深入強固了 `JourneyPreview.jsx` 中解析 Flex 訊息的每一層邏輯 (確保 Carousel / Bubble 型別對外來未規範 JSON 的抵禦)。針對陳舊、未定義、甚至陣列錯亂的卡片，均實作即時 try-catch 與型別驗證，根絕了使用者點擊「檢視群發內容」時因非同步渲染失敗導致的「全白/全黑畫面崩潰」災情。

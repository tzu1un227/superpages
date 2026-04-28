# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- **群發訊息與問卷自動化增強 (Broadcast & Questionnaire Automation Enhancement)** [2026-04-24]:
  - **排除封鎖用戶 (Exclude Blocked Users)**：在群發訊息（Broadcast）的受眾篩選與發送階段，新增自動排除「封鎖/取消追蹤 (Unfollow)」用戶的邏輯。透過比對歷史紀錄中的最新狀態，確保訊息僅送達仍在使用中的好友，提升發送準確率並精確統計受眾人數。
  - **問卷自動上標籤 (Questionnaire Auto-tagging)**：
    - **題目級別標籤設定**：在問卷編輯介面的每個題目下方新增「標籤設定」欄位。
    - **即時觸發標註**：當用戶回答問卷題目時，系統會自動將設定的標籤標註至該用戶身上，實現即時的用戶行為追蹤與分眾標籤化。
    - **資料持久化與還原**：優化問卷後端邏輯，支援在編輯已存在的問卷時正確還原題目對應的標籤設定。
- **UI/UX 持久化與圖文選單自動化權限控管 (UI/UX Persistence & Rich Menu Automation)** [2026-04-24]:
  - **全域任務進度條 (Task Persistence)**：實作 `TaskContext` 全域狀態管理，將「自動旅程」的匯入與排序進度條搬移至全域佈局。現在使用者在執行長任務時切換分頁，進度條仍會持續顯示並更新，不會因頁面卸載而消失。
  - **訊息中心雜訊過濾 (Message Center Filtering)**：在訊息中心對話紀錄中自動過濾 `Postback` 類別的系統訊息與 `set_tag` 指令，大幅減少客服人員查閱時的干擾。
  - **Rich Menu 自動標籤權限控管 (Auto-Assignment)**：
    - **規則編輯介面**：在圖文選單管理頁面新增「權限控管」分頁，支援建立「標籤 <-> 圖文選單」的映射規則。
    - **後端自動觸發**：當系統偵測到用戶被標註指定標籤時（透過連結點擊或選單按鈕），後端將自動呼叫 LINE API 為用戶切換至對應的選單，實現階層式的選單自動切換功能。
  - **訊息中心與圖文選單體驗優化 (Message Center & Rich Menu UX Refinement)** [2026-04-24]:
    - **訊息中心閃爍修復**：優化 Skeleton 骨架屏顯示邏輯，解決在搜尋或切換標籤時清單跳動與閃爍的問題。
    - **標籤同步機制強化**：在訊息中心手動新增或刪除標籤後，自動觸發標籤篩選列更新。
    - **圖文選單搜尋與排序**：在圖文選單管理頁面新增「搜尋框」，並將列表排序優化為 `richMenuId` 降序排列（最新建立的選單在前）。
    - **術語全域統一 (Rebranding)**：將系統中所有對外顯示的 "Flex Message" 或 "Flex 訊息" 統一更改為 **"圖文訊息"**，涵蓋訊息中心、廣播發送、法則表設計及編輯器介面。
    - **標籤輸入框優化 (TagInput)**：加大標籤輸入欄位的點擊感應範圍 (min-height 提升至 48px)，並調整內距與輸入佈局，確保觸控與點擊判定更精確。
    - **群發廣播身份修正**：修正立即發送廣播時的觸發者身份為 `system`，防止訊息標籤被誤上在管理員 (yzuadmin) 帳號。
    - **Google 登入姓名保護**：優化 Google OAuth 登入邏輯，若資料庫中已有使用者手動編輯過的姓名，則不會被 Google 原始資料覆蓋。
- **法則表設計雙模式與圖文選單標籤功能增強 (Rule Designer Dual-Mode & Rich Menu Tagging)** [2026-04-20]:
  - **法則表雙分頁模式**：在法表設計頁面加入「簡易模式」與「工程模式」切換。簡易模式大幅精簡欄位（僅顯內容與回應），優化非技術人員的操作體感。
  - **圖文選單標籤整合**：
    - **按鈕上標籤**：為圖文選單的「傳送文字」與「Postback」按鈕加入標籤設定，儲存時自動轉換為 `tag_true|` 協議格式。
    - **連結上標籤 (轉跳代理)**：為「跳轉網頁」按鈕加入標籤支援。修正了相對路徑導致 LINE 驗證失敗的問題（現在強制使用 HTTPS），並移除了圖文選單不支援的 `<%m.user_id%>` 模板。
    - **UUID 排序與介面簡化**：移除日期解析與分組，改為依據 `richMenuId` (UUID) 進行排序。
    - **預設選單重置功能**：新增「重置預設」按鈕，協助解除全域預設連結，解決同步問題。
    - **編輯器偵測與解析**：實作 `extractTagsFromValue` 邏輯，讓編輯器能自動還原標籤與原始內容。
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

- **�۰ʮȵ{�µe���״_�P�ݨ������޿��s (Projects Fix & Questionnaire Tag Logic Update)** [2026-04-24]:
  - **�״_�۰ʮȵ{�µe��**: �ץ��F Projects.jsx ���]�~�R���a���A�ܼƦӾɭP�� ReferenceError�C�{�b�w���T�ޥ� TaskContext ���Ѫ� 	askState ���쪬�A�C
  - **��s�ݨ������x�s�榡**: �ݨ��޲z�ͦ������ҫ��O�q set_tag| �ܧ󬰲ŦX�зǪ� pri_push('tag','...')�C
  - **�W�j�ݨ����Ҵ����ۮe��**: ��� _extract_tags_from_fn �{�b�䴩�P���ѧO�ô����s�¨�خ榡�����ҳ]�w�C

  - **標籤元件與問卷互動優化 (TagInput & Questionnaire UI Fixes)** [2026-04-24]:
    - **修正問卷標籤功能**: 解決 Questionnaire.jsx 中 TagInput 的 Prop 名稱不匹配問題，恢復新增標籤功能。
    - **優化標籤輸入互動**: 實現點擊 TagInput 容器任何位置自動聚焦輸入框，並加大點擊判定區域，提升使用體驗。

  - **Flex 訊息佈局與預覽優化 (Flex Layout & Preview Optimization)** [2026-04-24]:
    - **修復輪播高度不對齊問題**: 解決混合使用卡片時圖片卡片底部出現白塊的問題，透過明確定義 body/footer 並填充背景色實現視覺統一。
    - **增強預覽準確性**: 更新 JourneyPreview 組件，使其能更真實地模擬 LINE 的氣泡對齊與樣式細節。

  - **訊息中心與推播邏輯優化 (Message Center & Push Logic Optimization)** [2026-04-24]:
    - **訊息中心過濾**: 隱藏 Postback、Sensor、Follow 等系統事件，並優化側邊欄顯示，將這些指令標示為「[系統指令]」。
    - **Flex 編輯器**: 增加圖片型卡片的「延伸背景顏色」設定，解決輪播對齊時的背景色差問題。

  - **歷史紀錄與對齊優化** [2026-04-24]:
    - 解決自動旅程重複存檔問題（移除 cronjobs.py 重複紀錄）。
    - 訊息中心 sys_push 訊息改為靠右對齊，符合發送者邏輯。

  - **介面邏輯優化** [2026-04-24]:
    - 修正訊息中心左側用戶清單，現在會過濾掉系統指令 (Postback, Sensor等)，真實顯示使用者最新互動訊息。
    - 優化 Flex 編輯器：強制輪播訊息（Carousel）必須統一使用單一模板（選項型或圖片型），防止版面因混用而跑版。
-   2 0 2 6 / 0 4 / 2 7 :   *QS  R u l e D e s i g n e r   !|f!j_�vkMOT1z�N&{T^��bS��N�T�v�v���&N7_6R  F l e x M e s s a g e E d i t o r   (W*��d!j_Nq} N!jg<h_�N�MQэHr0 
 - **自動旅程預覽功能增強** [2026-04-27]:
  - 在 Projects.jsx 的預覽旅程 Modal 中，新增「設定基準時間」欄位。
  - 將原始 interval_hours 傳入 JourneyPreview 前，根據基準時間計算並顯示準確的「預計發送時間」，提升直覺性。
  - 調整 JourneyPreview.jsx 中 delayLabel 樣式支援 white-space: pre-wrap 以正常顯示換行。

- **訊息中心顯示優化** [2026-04-27]:
  - 在 MessageCenter.jsx 的用戶列表，針對 Flex 訊息類型，將顯示格式從「[圖文訊息]」更改為簡潔的「圖文訊息」。

## [Unreleased]
- **客戶中心實作 (Customer Center Implementation)** [2026-04-28]:
  - **前端頁面**：建立 CustomerCenter.jsx 並套用暗色系主題。
  - **頁籤設計**：提供「客戶資訊」、「目標客群」、「標籤管理」三大頁籤。
  - **後端 API**：建立 /api/customers 與 /api/customers/groups 以從 private_var 和 history 表格撈取客戶資料。
  - **導覽列整合**：於 App.jsx 的路由及選單加入客戶中心。

  - **客戶中心：排序與標籤管理功能** [2026-04-28]:
    - **欄位排序**：實作 CustomerCenter.jsx 的前端點擊欄位標題排序功能 (客戶名稱、最近互動時間、標籤)。
    - **標籤管理頁籤**：實作 /api/customers/tags 後端 API，撈取 Private_var 內的標籤統計，並在前端標籤管理頁籤以列表顯示各標籤之標記人數。

  - **客戶中心：客群與標籤連動查看功能** [2026-04-28]:
    - **客戶過濾聯動**：實作 CustomerCenter.jsx 中，目標客群與標籤管理頁面的「查看」按鈕及名稱點擊功能，點擊後會自動跳轉回客戶列表，並根據所選取的客群或標籤進行名單過濾顯示。

  - **客戶中心：搜尋功能與介面優化** [2026-04-28]:
    - **全域搜尋**：實作上方搜尋欄位，支援在客戶資訊、目標客群、標籤管理三個頁籤中進行即時關鍵字篩選。
    - **介面微調**：移除客群與標籤列表中的「編輯」按鈕；讓「新增客群」按鈕僅在目標客群頁籤時顯示；並依照要求移除客戶列表中的 user_id 顯示，讓畫面更加簡潔。

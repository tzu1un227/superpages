### **版本更新記錄**
*   **2025/12/7**:
    *   調整開發階段順序，以「用戶認證」為優先，確保系統架構穩健。
    *   新順序：核心功能 -> 用戶認證 -> 多帳號管理 -> 受眾分群。
*   **2025/12/10**:
    *   更新資料庫模型：合併 `users` 和 `user_permissions` 表，將權限整合到 `users.allowed_oa_configs` (JSON 清單 of oa_config IDs)。新增 `pages` 表管理頁面。調整權限描述和任務細節。

---

### **視覺化網頁系統 - 開發步驟計畫**

#### **總體策略**
本計畫將開發過程分為四個主要階段。從建立核心的數據視覺化功能開始，先針對單一官方帳號（OA）進行開發，確保核心業務邏輯正確無誤。隨後，整合用戶註冊與認證機制，接著擴展至支援多帳號管理、管理員權限系統，最後完成受眾分群與收尾工作。

---

### **階段一：核心視覺化功能開發 (單帳號模式)**

**目標**：快速實現系統的核心價值，讓使用者能看到單一 Line OA 帳號的數據視覺化圖表。此階段將暫時硬編碼（Hardcode）一個遠端資料庫的連接設定，專注於前後端數據串接與圖表呈現。

1.  **後端 API 建置 (Python Flask)**
    *   [x] **任務 1.1：環境設定與資料庫連接**
        *   [x] 建立 Flask 專案結構。
        *   [x] 安裝必要的套件 (Flask, psycopg2-binary, Flask-CORS)。已更新 requirements.txt 加入 Flask-SQLAlchemy, google-auth-library, PyJWT。
        *   [x] 設定一個暫時的設定檔，寫入單一遠端 PostgreSQL 資料庫的連接資訊。
        *   [x] 建立資料庫連接模組，確保能成功連線並呼叫資料庫函式。

    *   [x] **任務 1.2：開發數據儀表板 API**
        *   [x] **FR-002 API**: 創建 `GET /dashboard/user_trend` 端點，根據時間區間 (`period`) 和分群 (`group`) 參數，查詢用戶人數與加入趨勢數據。已實現，但需要更新為支援分群參數。
        *   [x] **FR-003 API**: 創建 `GET /dashboard/responses` 端點，根據時間區間和分群參數，查詢並統計關鍵字回應趨勢。已實現，但需要更新為支援分群參數。

2.  **前端 UI 開發 (React)**
    *   [x] **任務 2.1：專案初始化與 UI 框架整合**
        *   [x] 使用 Create React App 或 Vite 建立專案。
        *   [x] 整合 Material-UI 作為 UI 元件庫，並引入 Recharts 用於繪圖。
        *   [x] 建立基本的專案結構，包括 `components`, `pages`, `services` 資料夾。

    *   [x] **任務 2.2：儀表板頁面開發**
        *   [x] 根據 `UI_Design.md` 文件，建構主頁面佈局（可收合的側邊欄 + 主內容區）。
        *   [x] 開發 **用戶趨勢儀表板頁面 (FR-002)**：
            *   [x] 放置時間區間與分群下拉選單。已實現時間區間選擇，需要新增分群下拉選單。
            *   [x] 呼叫後端 `GET /dashboard/user_trend` API。已實現。
            *   [x] 使用 Recharts 將回傳數據渲染成折線圖。已實現。
            *   [x] 實現載入中 (Spinner) 與無數據的提示狀態。已實現。
        *   [x] 開發 **用戶回應趨勢儀表板頁面 (FR-003)**：
            *   [x] 呼叫後端 `GET /dashboard/responses` API。已實現。
            *   [x] 使用 Recharts 將回傳數據渲染成條形圖。已實現。
        *   [x] **修正 FR-003 bug**：
            *   [x] 加入期間選擇。已實現。
            *   [x] 不同tag顯示人員數量。需要實作，後端API需支援分群參數。
            *   [x] 不同taSg顯示關鍵字數量。需要實作，後端API需支援分群參數。
            *   [x] 選週月年。已實現。
        *   [x] 微調UI功能：
            *   [x] 用戶互動趨勢開關tag。y軸自動調整
            *   [x] 用戶互動趨勢legend半透明。
            *   [x] 關鍵字排名支援分頁功能。
            *   [x] 關鍵字排名固定長度，太長的遊標移上去再顯示。
            *   [x] 加上排名編號。
            *   [x] 修改關鍵字表格，加入資料上限，調整每頁筆數。

---

### **階段二：用戶認證與本地資料庫 (FR-001)**

**目標**：整合 Google 登入機制與本地資料庫。此階段將引入 **SQLite** 作為本地資料庫，用於儲存 `users` 等管理資料表。SQLite 為一輕量級、無須獨立伺服器的資料庫，適合本專案初期的使用者與權限管理。用戶透過 Google 帳號登入後，後端將驗證其 Gmail 是否存在於 `users` 表中，成功則回傳 JWT 保護系統 API。

1.  **後端認證機制**
    *   [x] **任務 3.1：開發 Google 登入與驗證**
        *   [x] 設定 **SQLite** 資料庫，並使用 **SQLAlchemy** 定義 `users` 資料表模型（欄位：id, email, role ('admin'/'user'), allowed_oa_configs (JSON list of oa_config IDs), created_at）。
        *   [x] 整合 `google-auth-library`。
        *   [x] 開發 `POST /auth/google-login` 端點，接收前端傳來的 Google token。
        *   [x] 在端點內驗證 Google token，並取得用戶 Gmail。
        *   [x] 查詢本地 **SQLite** `users` 資料表，檢查該 Gmail 是否存在。
        *   [x] 若存在，則生成 JWT (JSON Web Token) 並回傳給前端；若不存在，則回傳錯誤。
    *   [x] **任務 3.2：API 安全防護**
        *   [x] 為除了 `/auth/*` 以外的所有 API 端點加上 JWT 驗證。
        *   [x] 從 JWT 中解析出用戶資訊，用於後續權限檢查（檢查用戶的 allowed_oa_configs 是否包含請求的 oa_config ID）。

2.  **前端認證流程**
    *   [x] **任務 4.1：開發登入頁面與 Google 登入流程**
        *   [x] 根據 `UI_Design.md` 2.1 節，建立包含 Google 登入按鈕的頁面。
        *   [x] 實現 Google OAuth 前端流程，取得 token。
        *   [x] 呼叫後端 `POST /auth/google-login` API。
        *   [x] 登入成功後，安全地儲存 JWT，並在後續所有 API 請求的 Header 中附上。
    *   [x] **任務 4.2：路由保護與用戶流程**
        *   [x] 設定前端路由守衛，未登入用戶將自動跳轉至登入頁。
        *   [x] 若 API 回傳錯誤（用戶不存在），則在頁面顯示「此帳號未被授權，請聯繫管理員」。

3.  **測試案例**
    *   **後端 (API 測試)**
        *   [x] **`POST /auth/google-login` 端點測試**
            *   [x] **成功案例**：使用一個已在 `users` 表中登記的有效 Google 帳號 Token 進行登入，應回傳 `200 OK` 狀態碼以及一個有效的 JWT。
            *   [x] **失敗案例 (未授權)**：使用一個有效的 Google 帳號 Token，但其對應的 Gmail 未登記在 `users` 表中，應回傳 `401 Unauthorized` 或 `403 Forbidden` 狀態碼。
            *   [x] **失敗案例 (無效 Token)**：使用一個無效、過期或格式錯誤的 Token 進行登入，應回傳 `400 Bad Request` 或 `401 Unauthorized` 狀態碼。
        *   [x] **API 保護測試 (JWT)**
            *   [x] **成功案例**：在請求受保護的 API (例如 `GET /dashboard/user_trend`) 時，於 `Authorization` 標頭中提供有效的 JWT，應能成功取得數據。
            *   [x] **失敗案例 (無 Token)**：請求受保護的 API 時，不提供 JWT，應回傳 `401 Unauthorized` 狀態碼。
            *   [x] **失敗案例 (無效 Token)**：請求受保護的 API 時，提供一個無效或過期的 JWT，應回傳 `401 Unauthorized` 狀態碼。

    *   **前端 (UI/E2E 測試)**
        *   [x] **登入與登出流程**
            *   [x] **成功登入**：在登入頁點擊 Google 登入，並使用一個已授權的帳號登入，頁面應成功跳轉至儀表板主頁。
            *   [x] **未授權登入**：使用一個未授權的 Google 帳號登入，頁面應停留在登入頁或顯示「此帳號未被授權，請聯繫管理員」的明確錯誤訊息。
            *   [x] **登出功能**：若系統有登出按鈕，點擊後應清除用戶登入狀態（JWT），並將用戶導向至登入頁。
        *   [x] **路由保護**
            *   [x] **直接訪問受保護頁面**：在未登入的狀態下，嘗試直接透過 URL 訪問儀表板頁面 (`/dashboard`)，應自動被重定向到登入頁。
            *   [x] **登入後訪問**：登入後，應能自由訪問所有被授權的頁面。
        *   [x] **API 請求驗證**
            *   [x] **請求攜帶 Token**：登入後，在瀏覽器開發者工具的網路分頁中檢查，所有對後端 API 的請求，其 Header 中都應正確地包含了 `Authorization: Bearer <JWT>`。
    *   **測試後修改**
        *   [x] **登出按鈕**:在Line-Bot視覺化sidebar最下方列出目前登入的帳號，同時附上「登出」按鈕
        *   [x] **數據匯出功能**
            *   [x] 在前端收到資料後暫存，並在頁面提供匯出按鈕。
            *   [x] 按鈕觸發後生成csv文件，提供使用者下載前端暫存之資料。

---

### **階段四：系統優化與除錯 (Debugging & Refinements)**

1.  **連線與數據處理優化**
    *   [x] **Troubleshoot "test" OA Connection**
        *   [x] 驗證 DB URL 與連線能力 (Script confirmed)。
        *   [x] 驗證資料存在性。
        *   [x] 修復編碼問題 (Force UTF-8 Client Encoding)。
    *   [x] **數據可見性修復**
        *   [x] 修復 JSON 序列化問題 (Date objects converting to strings)。
        *   [x] 強制轉型 Count 為整數。

2.  **前端顯示優化**
    *   [x] **修復前端渲染過濾**
        *   [x] 處理空字串分類 (Fallback to selected data type)。
    *   [x] **樣式調整**
        *   [x] 修復稀疏資料顯示問題 (Conditional dots for single points)。
        *   [x] 調整線條樣式 (極細線條)。
        *   [x] 版面最大化與控制列優化 (Chart Controls in Header, Consistent Styling)。

---

### **階段三：基於登入身分帳號管理**

1.  **本地資料庫與後端重構**
    *   [x] **任務 5.1：建立本地 SQLite 資料庫與資料表** <!-- id: 20 -->
        *   [x] 定義 Models (User, Page, OAConfig) <!-- id: 21 -->
        *   [x] 建立 `db_utils.py` 或 `init_db.py` 用於初始化資料庫 <!-- id: 22 -->
        *   [x] 執行初始化腳本，建立資料表並寫入種子數據 (Pages: dashboard, OAConfigs: mock, Users: admin/user) <!-- id: 23 -->

    *   [ ] **任務 5.2：後端 API 重構** <!-- id: 24 -->
        *   [ ] 修改所有現有 API (`/dashboard/*`, `/groups/*`)，增加一個 `account` 查詢參數 (e.g., `?account=oa1`)，對應 oa_config ID。
        *   [ ] API 內部邏輯修改：
            1.  [ ] 驗證當前用戶是否有權限存取指定的 `account`（檢查用戶的 allowed_oa_configs 是否包含該 oa_config ID）。
            2.  [ ] 從本地 `oa_configs` 表中查詢 `account` 對應的遠端 `db_url` 和頁面資訊。
            3.  [ ] 使用該 `db_url` 動態連接到對應的遠端資料庫進行查詢。
        *   [ ] 修改 `dashboard/user_trend` 支援 `account` 參數 <!-- id: 25 -->
        *   [ ] 修改 `dashboard/responses` 支援 `account` 參數 <!-- id: 26 -->
        *   [ ] 實作權限檢查 Middleware/Decorator <!-- id: 27 -->

2.  **前端功能擴充**
    *   [x] **任務 6.1：開發管理員頁面 (API & UI)** <!-- id: 28 -->
        *   [x] **後端 API 開發**： <!-- id: 29 -->
            *   [x] 用戶管理：`POST /admin/users`, `DELETE /admin/users/{id}`, `GET /admin/users` <!-- id: 30 -->
            *   [x] 網站設定管理：`GET`, `POST`, `PUT`, `DELETE /admin/oa_configs` <!-- id: 31 -->
        *   [x] **前端頁面實作**： <!-- id: 32 -->
            *   [x] 建立「管理員專區」，包含「用戶管理」與「網站設定」兩個分頁。
            *   [x] **用戶管理分頁**：列表顯示、新增用戶表單 (輸入 Gmail & 角色)、編輯權限 (勾選可用 OA)、刪除用戶。
            *   [x] **網站設定分頁**：列表顯示、新增/編輯 OA 設定 (OA名稱, DB URL)、刪除設定。
            *   [x] 建立 `AdminPage` (Tabs: User Management, OA Configs) <!-- id: 33 -->
            *   [x] 實作 Sidebar 連結與路由保護 (/admin) <!-- id: 34 -->

    *   [ ] **任務 6.2：支援多帳號切換 (頂部導航)** <!-- id: 35 -->
        *   [ ] 在普通用戶登入後，前端需根據其權限，在**頁面頂部 (AppBar)** 提供一個下拉選單，用於切換不同的 OA 設定。
        *   [ ] 切換帳號後，所有對儀表板和分群管理的 API 請求都需帶上新選擇的 `account` 參數。
        *   [ ] 在 `TopBar` 實作帳號切換下拉選單 <!-- id: 36 -->
        *   [ ] 整合 Context 或 State 管理當前選中的 Account <!-- id: 37 -->
        *   [ ] API 請求自動帶入 `account` 參數 <!-- id: 38 -->

3.  **測試案例**
    *   **後端 (API 測試)**
        *   [ ] **多帳號權限驗證**
            *   [ ] **成功存取**：使用擁有 `oa1` 權限的用戶 Token，請求 `/dashboard/user_trend?account=oa1`，應回傳數據。
            *   [ ] **越權存取**：使用僅擁有 `oa1` 權限的用戶 Token，請求 `/dashboard/user_trend?account=oa2`，應回傳 `403 Forbidden`。
            *   [ ] **無效帳號**：請求不存在的 `account` ID，應回傳 `404 Not Found` 或 `400 Bad Request`。
        *   [ ] **管理員 API 測試**
            *   [ ] **管理員存取**：使用 Admin 角色用戶 Token，請求 `GET /admin/users`，應回傳完整用戶列表。
            *   [ ] **普通用戶存取**：使用 User 角色用戶 Token，請求 `GET /admin/users`，應回傳 `403 Forbidden`。
            *   [ ] **CRUD 驗證**：測試用戶的新增、刪除、權限修改；測試 OA 設定的新增、修改、刪除。

    *   **前端 (UI/E2E 測試)**
        *   [ ] **多帳號切換**
            *   [ ] **下拉選單顯示**：登入擁有各個 OA 權限的用戶，**頂部導航列**應顯示帳號切換下拉選單。
            *   [ ] **無權限顯示**：登入無任何 OA 權限的用戶，下拉選單應為空或顯示提示。
            *   [ ] **切換連動**：切換下拉選單中的 OA，儀表板圖表應自動重新載入並顯示新 OA 的數據。
        *   [ ] **管理員功能**
            *   [ ] **管理頁面進入**：管理員登入後，側邊欄應顯示「系統管理」入口。
            *   [ ] **CRUD 操作**：在管理頁面新增/刪除用戶、新增/刪除 OA 設定，操作後資料庫應正確更新。

---

### **階段四：受眾分群管理與收尾工作**

**目標**：擴充分群管理功能，並完成數據匯出等功能。

1.  **後端 API 擴充 (FR-004)**
    *   [ ] **任務 7.1：開發分群管理 API**
        *   [ ] `GET /groups`：從遠端資料庫讀取現有分群列表。
        *   [ ] `POST /groups`：接收前端傳來的新群組資訊，**生成符合 Line API 格式的 JSON 訊息**，用於通知遠端系統。
        *   [ ] `PUT /groups/{id}`：接收更新的規則，同樣生成 Line message 通知遠端系統。
        *   [ ] 建立呼叫遠端 PostgreSQL function 的機制，以計算每個分群的用戶數。

2.  **前端功能開發 (FR-004)**
    *   [ ] **任務 8.1：開發分群管理頁面**
        *   [ ] 根據 `UI_Design.md` 設計，建立包含「群組列表」和「自動化規則」兩個子分頁的頁面。
        *   [ ] **群組列表**：
            *   [ ] 呼叫 `GET /groups` API，將分群數據渲染成表格。
            *   [ ] 實作「新增群組」功能，彈出模態框讓使用者輸入名稱，並呼叫 `POST /groups` API。
            *   [ ] 實作「編輯/刪除」功能。
        *   [ ] **UI 狀態管理**：
            *   [ ] 當使用者在前端編輯規則但未儲存時，UI 需顯示「需按鈕完成更新」和「回復成現有狀況」按鈕。
            *   [ ] 「完成更新」按鈕將呼叫 `PUT /groups/{id}` API 通知遠端。
            *   [ ] 「回復」按鈕則從遠端重新載入數據，捨棄本地修改。

3.  **收尾工作 (FR-005)**
    *   [ ] **任務 9.1：最終測試與部署**
        *   [ ] 根據 `FunctionalSpecification.md` 第 5 節的測試案例，進行端到端測試。
        *   [ ] 審查性能、安全性等非功能性需求。
        *   [ ] 準備部署文件 (Dockerfile, etc.) 並部署上線。
    *   [ ] **任務 9.2：數據匯出功能**
        *   [ ] 開發後端 API，接收當前圖表的數據和參數，生成 CSV 或 PDF 文件流。
        *   [ ] 修改前端儀表板的匯出按鈕，改為後端 API 呼叫。
# Architecture Documentation

## System Overview
This project is a web application with a Flask backend and a React frontend. It manages users, projects, and scheduled events, integrating with a Socket.IO server for real-time communication.


## Scheduled Event Management (摰𡁏閫貊䔄鈭衤辣 - Refactored)

All scheduling is now managed via **Projects** using the `cron_table`. The legacy `scheduled_events` table and processor have been removed.

### Core Components
1.  **Backend Processor**: `cron_scheduler_processor` in `backend/app.py`.
    -   Type: Background Daemon Thread.
    -   Interval: Checks database every 10 seconds.
2.  **Database**: 
    -   `projects`: Defines the project configuration (`is_enabled`, `is_recurring`, etc.).
    -   `project_schedules`: Defines the steps and messages for each project.
    -   `cron_table`: Tracks the current state (`step_id`, `scheduled_at`, `status`) for each user participating in a project.
3.  **Frontend**: `Projects.jsx` (Route: `/projects`).
    -   Provides UI for creating projects, defining schedules, and monitoring status.

### Execution Logic
1.  **Polling**: The processor wakes up every 10 seconds.
2.  **Selection**: Queries `cron_table` joined with `projects` for rows where:
    -   `status` is 'active'.
    -   `scheduled_at` <= Current Time.
    -   Project is enabled (`is_enabled = TRUE`).
3.  **Trigger**:
    -   Fetches the message content from `project_schedules` for the current `step_id`.
    -   Connects to the Socket.IO server (`WS_URL` or OA-specific URL).
    -   Emits a message event to the target user.
4.  **Advancement**:
    -   Calculates the next execution time based on the *next* step's `interval_hours`.
    -   Updates `cron_table` with the new `step_id` and `scheduled_at`.
    -   If no next step exists:
        -   If `is_recurring` is TRUE: Resets to Step 0 (Loop).
        -   If `is_recurring` is FALSE: Sets `status` to 'completed'.

### Projects and Schedules
-   **Structure**: A Project consists of multiple Steps (0, 1, 2...).
-   **Step 0**: The initial trigger or first delay.
-   **Recurrence**: Projects marked as `is_recurring` will automatically restart from Step 0 for a user after the last step is delivered.

### Rich Message Handling
-   **QA Integration**: Messages can be stored as complex structures (Flex, Image, etc.) in the `qa_bank` table.
-   **Reference Protocol**: In `project_schedules` or other text fields, these are referenced using the `QA|` prefix followed by the unique tag (e.g., `QA|cron_project_step`).
- **Schedule Settings**: Managed within the `ProjectsManagement` component in `Projects.jsx`. Supports multi-step messaging workflows with configurable delay intervals (Years/Months/Days/Hours/Minutes).
- **Schedule Editing UX**: Implementation of "Saving..." feedback state and button locking during schedule updates to prevent race conditions and improve user feedback.

- **Rich Message Previews**: The `get_schedules` API endpoint automatically enriches schedule entries with descriptive previews for Linked QA bank tags. It parses the first message from the message sequence (text, flex, image, etc.) and provides a human-readable summary.
- **Frontend Robustness**: Implementation uses defensive coding patterns (optional chaining, array guards, fallback values) to ensure UI stability even with incomplete or malformed backend data.
- **Editor Behavior**: The frontend detects this prefix to open the advanced visual editor instead of a plain text input.
- **Image Upload**: The Flex Message Editor includes an upload button that allows users to upload images directly to a configured GitHub repository. The backend handles the GitHub API integration and returns the raw image URL.

### UI/UX Optimization & Content Validation
- **Global Toast Notification**: A centralized `ToastContext` and `Toast` component handle system notifications, providing non-blocking feedback that auto-hides after 5 seconds.
- **Broadcast Content Preview**: The backend `/broadcast/` list endpoint performs on-the-fly reconciliation and fetches message summaries from the OA's `QA_bank` for responsive frontend previews.
- **Inline Flex Preview**: The broadcast editor incorporates a scaled-down `JourneyPreview` to provide immediate visual feedback for Flex message structures without context switching.
- **Rich Menu Management**: Standardized to Chinese (Traditional). Implemented form validation (disabling save unless an image and all area actions are properly configured) and fixed runtime crashes using optional chaining and safe state resets.
- **Rich Menu Localization**: TERMINOLOGY in the Rich Menu module is standardized to Chinese to improve usability for non-English speakers.

### UI/UX 芸摰寥霅 (UI/UX Optimization & Content Validation) [2026-04-24]
- **閮𦠜銝剖 (Message Center)**:
    - **靽桀儔 Skeleton 芸**: 芸 `loadingUsers` 衤 Skeleton 憿舐內讛摩嚗典憪贝交𨅯蝯鞉箇征＊蝷綽脫迫芸頛芾岷蝐文𥟇箇𣶹恍𢒰喳
    - **璅嗵惜啣單峕郊**: 撖虫璅嗵惜啣⏛文 `fetchAvailableTags` 噼矽璈笔嚗𣬚Ⅱ靽萘祟詨厰賢朖䭾蝐斗𨰻
- **典銵栞蝯曹 (Standardization)**:
    - **𡝗閮𦠜 (Rich Message)**: 撠蝟餌絞嚗急”誨剔䔄臭葉敹蝺刻摩剁銝剖厩 "Flex Message"  "Flex 閮𦠜" 蝯曹游箝胯㵪𣂼墧銵栞臭蝙刻蠘亙漲
- **𡝗詨鱓 (Rich Menu)**:
    - **𨅯摨誩撘**: 典銵刻碶葉游峕撠𧢲㵪銝血鍦箸箏 `richMenuId` 滚嚗啣銁㵪嚗峕恣之誯格炎蝝Ｘ
- **璅嗵惜頛詨獢 (TagInput Component)**:
    - **鈭鍦文蝭芸**: 隤踵㟲 `TagInput` 辣 `min-height`  48px 銝血懲頝嘅閫捱閫豢綉鋆萘蔭㚚𦠜文罸蝒栞孛潸撓交阡憿䎚
- **敺𣬚垢頨思遢撽𡑒 (Backend Security/Consistency)**:
    - **撱偘閫貊䔄頨思遢蝞∠**: 靽格迤蝡见朖潮誨剜 WebSocket 鈭衤辣 `user` 彍眏笔箏 `yzuadmin` 寧 `system`嚗𣬚Ⅱ靽萘頂蝯梯䌊閗孛潛閮𦠜璅嗵惜銝齿鋡怨炊𡏭喟恣摱撣唾
- **典隞餃讠恣 (Global Task State Persistence)** [2026-04-24]
    - **TaskContext**: 撖虫典 React Context嚗𣬚恣 `isProcessing`progress`  `processingMessage`
    - **UI **: 撠 `StatusIndicator` 祉宏 `App.jsx` 煺撅銝哨閫捱諹䌊閙蝔卝滚銁臬𡝗摨𤩺枏𥕦嚗屸脣漲璇脲删隞嗅桊頛㕑峕憭梁誯
    - **隞餃滨蔭**: 𣂷 `resetTask` 寞嚗𣬚Ⅱ靽脲雿𨅯鞉憭望敺諹甇Ⅱ皜典卝

### UI/UX 芸摰寥霅 (UI/UX Optimization & Content Validation) [2026-03-18]
- **𡝗詨鱓 (Rich Menu)**:
    - **頛匧憭望閧**: 𣪧銝餅 (`/richmenu/`) ê̌齿 (`/richmenu/aliases`)  API 航炊娍⏛𥅾銝餅桀仃梹撠覔 HTTP 讠Ⅳ𣂷琿筆嚗芾身摰 LINE Token㵪嚗𥕦ê̌齿桀仃堒⊿暺䁅銝漤獈钅Ｖ蜓擃娍葡瓐
    - **銝𠰴鞟內撘瑕**: 澆碶喳𡒊Ⅱ璅嗵內 `1MB` 獢之撠誯嗚
- **𦠜銝剖 (Message Center)**:
    - **湧甈砍 (Virtual Pagination)**: 嘥冽皜鱓撖虫箸䲰皛曉鈭衤辣蝡航砍嗚憪贝 15 蝑嗡蝙刻銝𧢲閗秐摨閖貝蕭牐銝辷其靽格㺿敺𣬚垢 API 蝯鞉𣂷憭批𣂼皜脫憪贝𡝗𨰜
- **芸 (Projects)**:
    - **璅嗵惜閬𤥁死 (Tag Badges)**: 冽訫亦鍂嗥敶枂閬𣇉 (`UserSelectModal`) 銝哨敺拍鍂銝血碶璅嗵惜閫讛摩 (`parseTags`)𧋦隞亙銝脫𣄽亙耦撘誩曄筆璅嗵惜嚗諹𤤿函閫垍 pill/badge 璅𣶹嚗峕雿靝Ｙ渲扼

### UI/UX 芸摰寥霅 (UI/UX Optimization & Content Validation) [2026-03-10]
- **Loading 讠恣**: 
    - 撖虫 `Projects.jsx` 銝剔 `pageLoading` 页嗅䜘諹䌊閙蝔卝滚詨銝滚撠孛 `LoadingSpinner` 銝血銁 API 𧼮齒蝛箄豢
    - 蝣箔冽典𥕦獢嚗峕蝔见銵刻蝯梯豢銝齒箇𣶹頝典獢畾条憿舐內
    - **蝡嗆璇苷辣蹱嗘耨敺 (2026-03-30)**嚗
        -  `fetchSchedules` 銝剖 `selectedProjectIdRef` 瘥𥪜吔蝣箔唳郊𧼮𥅾撌脣𥟇蝔见銝齒凒啗鞈
        -  JSX 皜脫撅文 `schedules` 𡑒”撖行鴌 `filter(s => s.project_id == selectedProjectId)` 銋钅俈蝳行折瞈整
- **脤閮𦠜蝺刻摩冽楛摨阡霅**: 
    - 撘瑕 `Projects.jsx` (RichMessageModal)  `Broadcast.jsx` 摮㗛霅厰頛胯
    - 瘛勗漲閫 Flex Message JSON 蝯嚗屸撠齒匧㨃 (Bubbles) 𠰴雿 (Hero Action)灘峕訫雿 (Footer Buttons)漤脰䂿征瑼Ｘ䰻
    - 仿 (URI)單摮 (Text/Data) 箇征嚗𣬚頂蝯勗芸摮䀝蒂鞟內雿輻鍂朣𨳍
- **冽𡑒”芸**:
    - **梁陛瞏**: 蝘駁膄銝餅株見懲皜鱓銝剔 User ID 憿舐內嚗＊蝷箔蝙刻蝔梧亦＊蝷箝峕𧊋賢溻
    - **璅嗵惜閫**: 嘥見懲敶 (`UserSelectModal`) 銝剔璅嗵惜憿舐內嚗祕靝澆捆 JSON List (`["A","B"]`)  Pipe 璅躰 (`|A|B|`) 撥亥圾鞾頛荔蝣箔璅嗵惜賭箇崕蝡𧢲雿濱閫𣶹

- **脰遘銵𣬚雿喳 (Message Center)**: 嘥 `MessageCenter.jsx`  7 蝘坿䌊閗憚閰Ｘ凒堆撠𤾸雿濱蔭靽肽風璈筆 `isAtBottom` 箸斗𪃾嚗諹圾瘙箇𧞄Ｚ歲閗芸銝𧢲喳函唳曎
- **撱偘鞱汗**: 撖虫滨垢 `messages` 𡑒”鞱汗讛摩嚗峕硋憿噼舐鸌敺蛛Type Icon + 芣𪃾嚗厰＊蝷箸䲰撱偘甇瑕蟮皜鱓銝准

 ### User Tagging (冽璅躰酉)
 - **Flex Message Integration**: The Flex Message Editor allows users to associate multiple tags with button actions or image clicks.
 - **Protocol**: Tags are embedded in the `postback.data` payload using the `|set_tag|tag1|tag2|...` command suffix.
 - **Event Splitting (Simulation)**: For simulation/websocket triggers, the Superpages backend splits combined data into two events (Message + Postback) to ensure correct rule matching and tagging simultaneously.
 - **Frontend Component**: `TagInput.jsx` provides a dedicated UI for multi-tag selection with autocomplete support fetching from `/api/tags`.
 - **Rich Menu Extension**: 
    - **Tagging Support**: Rich Menu areas (Message, Postback, URI) now support multiple tags.
    - **Redirect Proxy Protocol**: When a URI action has tags, it is automatically converted to a proxy URL: `https://[BASE_URL]/api/redirect?url=[URL]&tags=[TAGS]`. The proxy logs the tags via WebSocket before redirecting the user.
    - **Prefix Protocol**: Message and Postback content for tagged buttons are stored with the `tag_true|tag1,tag2|content` prefix, allowing the rule engine to process tags via the `tag_true|*` rule matching.
 
### Lottery Management (賜蝞∠)

#### Components
1.  **Frontend**: `PrizeStatus.jsx`.
    -   Displays `gameStatus` (Fetched from `/api/game-status`, source: `Global_var:5013` -> `SYS_STAT`).
    -   Lists prizes (`tickets`) from `ticket_table`.
    -   Provides controls to Start/Stop game (via direct socket triggers) and manage prizes (Delete/Create).
    -   Displays "Registered Users" list (Name + Partial UserID).

2.  **Database**:
    -   `ticket_table`: Stores the list of prizes (`id`, `name`, `order`, `user_id`).
    -   `person_table`: Stores user information (`name`, `user_id`, etc.) for the registered users list.
    -   `Global_var:5013`: Stores the system status key `SYS_STAT` ("WAIT" = Not Started, "RUN" = In Progress).

3.  **Endpoints**:
    -   `GET /api/game-status`: Returns the current game status.
    -   `DELETE /api/tickets/<id>`: Deletes a specific prize.
    -   `GET /api/registered-users`: Fetches list of registered users. Supports `source` parameter:
        -   `source=private_var` (default): Fetches from `Private_var` (requires `name` and `pic`), used for Projects.
        -   `source=person_table`: Fetches from `person_table` (returns `user_id`, `name`), used for Lottery.
    -   `get_tickets` and `trigger_socket_event` (existing).

### Message Center (閮𦠜銝剖)
- **Frontend**: `MessageCenter.jsx`.
  - Displays list of users and their chat history.
  - Supports sending messages and managing tags.
  - **潮䔄脰風 (Anti-Double Send)**: 撖虫 `isSendingRef` (Ref Lock)  `isSending` (State) 璈筆訜潮葉急蝳鍂頛詨獢厰嚗䔶蒂娍⏛敺𣬚 Enter 菜暺墧鈭衤辣嚗屸俈甇ａ銴䔄
  - **芸蝞∠ (Projects Management)**:
    - **閮𦠜蝺刻摩 (RichMessageModal)**: 舀螱蔣唾 Flex 閮𦠜急雿滚游漲撽𡑒嚗俈甇Ｙ征批捆嚗剹
    - **垍讛摩**: 蝣箔 Step 0 雿𦦵韏琿銝滚虾芷膄嚗𣬚雁霅瑟蝔见湔扼
    - **冽蝞∠ (UserSelectModal)**: 游 `/api/registered-users`  `/api/tags`嚗峕𣈲渲嚗蝔 + 璅嗵惜嚗㗇撠页𣂷閬𤥁死𡝗蝐斤祟豢綉園
  - **誩㭘蝞∠ (Questionnaire)**:
    - **誩㭘芸銝𦠜蝐 (Auto-tagging)**: 舀螱券株身摰帋葉懲璅嗵惜訜冽䂿閰脤格嚗𣬚頂蝯望誯閬誩摨思葉 `function` 甈瑁 `set_tag` 誘嚗撠齒璅嗵惜芸璅躰酉潸府冽蹱拇䲰單閙冽誩末銝阡脰䔿
    - **閙讠𤩎**: 蝟餌絞芸Ｙ `Q[ID][SEQ]` 璅∪卝𥅾毺鍂𣬚獢炎乓㵪憿滚Ｙ銝貝歲頧㕑秐 `Q[ID]99` 憿抒卝
    - **𣂼讛摩**: 拍鍂 `sys.now_between`  `sys.now()` 瘥磰讛摩嚗銁誩㭘亙藁閬誩 `check` 甈銝剖祕暹畾萄ế瑯
    - ****: 瘥譍憿𣬚蝑娍誯 `pri_set` 脣 `ans_{誩㭘濱迂}_Q{憿諹}`嚗䔶蒂典憿折畾菟誯 `sys.pri_get` 閙霈硋整
  - **蝢斤䔄閮𦠜 (Broadcast)**:
    - **潮霅**: 函䔄脣厩阮脰瘛勗漲閮𦠜批捆瑼Ｘ葫嚗 Flex 抒訫雿頣
  - **冽皜鱓𨅯 (User List Search)**:
    - 𨅯獢摰 `searchQuery` state嚗屸誯 debounce嚗300ms嚗匧潮 API 隢𧢲嚗峕𣈲港 `user_id` 蝙刻蝔望撠卝
    - 𨅯獢坔朖斗𤏪X嚗剹
  - **璅嗵惜蝭拚 (Tag Filtering)**:
    - 頛匧匧虾冽蝐支蒂憿舐內箏虾暺鮋蝐斗訫銵剁怒具漤
    - 暺鮋璅嗵惜敺䕘隞 `tag` query parameter 喳 `/api/users`嚗𧼮閰脫蝐斤冽
  - **敹怠讠恣 (Cache & State Management)**:
    - 撠𤾸 `messagesCacheRef` 雿𦦵冽閮䀹擃𥪜翰吔雿踹𧼮歇見憭拙恕賜栞亥閮𦠜
    - 蝯𣂼 `after` 喟峕艶芾岷嚗諹䌊閗朣𠰴翰硋𤩺鰵閮𦠜嚗祕暸妟蝑匧蝮怠偦撽𨰜
  - **脰遘雿濱蔭蝞∠俈頝喳 (Scroll Management)**:
    - **雿濱蔭 (Scroll Persistence)**: 雿輻鍂 `userScrollPositionsRef` (Mutable Ref) 蝝讠鍂嗥 `distanceFromBottom`  `scrollTop`
    - **箸蝵桀嗆敺**: 冽交憭扳䲰 100px 銝𦠜㬢閧敺 `scrollTop`嚗炏嘑銵 `scrollToBottom`
    - **脰歲訫雿 (useLayoutEffect)**: 嗉亙擗䀹風脰荔睲鞾嚗㗇嚗⏚ `React.useLayoutEffect` 函讛汗券蝜芸閮 `scrollHeight` 撌桀潔蒂鋆𣈯 `scrollTop`嚗祕曇閬箔蝮怠雿溻
    - **蝛拙 DOM Key**: 閮𦠜𡑒”雿輻鍂蝯𣂼 `timestamp`  `index` 帘摰𡁜銝脖 `key`嚗屸俈甇 React 冽凒唳瑟滚遣 DOM 蝭暺𧼮湔㬢頠賊憭晞
  - **𣇉/慦㘾頛匧峕郊 (LazyImage)**:
    - **詨璈笔**: 箔閫捱𧼮甇亙擃磰亙渡𢒰冽嚗ayout Shift嚗㚁撠𤾸 `LazyImage` 辣擃𥪜隞嗅銁讛汗刻孛 `onLoad` 摰峕皜脫㵪撠誑勗耦讠雿齒憿舐內嚗𣬚Ⅱ靽嘥捆券摨血銁航滾歇蝣箏
    - **單蝵桀**: 慦㘾頛匧摰𣬚佅敺䕘 `isAtBottomRef` 箇嚗蝡见隤輻鍂 `scrollToBottom`
  ### 𦠜銝剖摰嫣誨 (Message Center & Content Proxy)
箔蝣箔賣迤撣賊＊蝷 LINE 隡箸蝡舐雿輻鍂擃䈑憒蔣嚗𣬚頂蝯勗祕靝敺𣬚垢 Proxy 頝舐眏嚗
- `/api/line/content/<message_id>`: 撣嗅孵董毺 `line_token` 隢𧢲 LINE API 銝血喃脖鞈
- 滨垢雿輻鍂 `AuthenticatedImage` 辣嚗屸誯 `api.get` (撣嗆 JWT Token) 脣批捆銝西 Blob URL 憿舐內
  - **撠滩店批捆𨅯 (Message Content Search)**:
    - 𠰴予摰支寞函𨅯獢舀撠讠訜函鍂嗥撠滩店批捆
    - 蝚血萄隞仿脰舫鈭桅＊蝷綽誯 `highlightText` 賢嚗㚁銝阡＊蝷箇泵詻
  - **Message Display**:
    - Messages from `yzuadmin`, or with category `Sensor`, `Response`, or `sys_reply` are displayed on the right (Admin/System side).
    - `sys_reply` messages are displayed with rich content (text/image/video/audio/flex).
- **Backend**:
  - `GET /api/users`: 啣 `q`嚗萄嚗匧 `tag`嚗蝐歹亥岷彍
    - **瘛勗漲瑼Ｙ揣讛摩**嚗䫤q` 彍撠 `user_id`㵪Private_var嚗㚁隞亙 `history` 銵其葉勗摰嫘
    - **Unicode 頧厩儔閧**嚗朞䌊訫𨅯𣈯枤摮𡑒蝢拍 `\uXXXX` 摨誩嚗蒂脰䠷頧厩儔瘥𥪜嚗㚁蝣箔賣撠見 JSON 澆銝剖摮条 Unicode 蝺函Ⅳ銝剜摮堒摰嫘
    - **QA_bank 游**嚗朞𥅾 `history` 批捆 QA 璅嗵惜嚗 `cron|QA|...`嚗㚁䌊閗蝯 `QA_bank` 銵冽撠見撠齒臬摰對`ans`  `msg_rpy`嚗㚁峕舀螱 Unicode 頧厩儔瘥𥪜
  - `GET /history/<user_id>`: 脣冽渲憭拍

## Data Analysis & Statistics (豢絞閮)

### Core Components
1. **Integrated Project Metrics**: Located within `Projects.jsx` -> `activeTab === 'schedules'`.
    - 憿舐內撠孵嚗𡁜鞟 (completion_rate) 芸憿舐內潔對嗆活箇蜇摰峕甈⊥彍 (tcc)孛澆恥嗆彍 (tc)/憭望 (mss/msf)
   - Metrics are filtered by the selected project and the specified date range.
2. **Global Account Analysis**: Located within `Statistics.jsx`.
    - **Trend Analysis**: Fetches grouped data from `/api/statistics`. (Global metrics: 蝮質舫, 啣憟賢 [鞈摨 Follow], 撠/閫膄 [鞈摨 Unfollow], 㗇憟賢 [閰脫畾萄瘥𤩺𠯫瘣餉鈭箸活])
    - **Total Calculation**: The backend now also returns `total_counts` for the selected period. The "Effective Friend Count" card displays a strictly distinct user count for the entire duration, avoiding double-counting of recurring active users.
    - **Unfollow Tracking**: The Line-Bot engine captures `UnfollowEvent` and records it in history as an `Unfollow` category, which is then aggregated by the dashboard.
    - **Keyword Ranking**: Fetches data from `/api/statistics/keywords` (Top keyword rankings).
    - **Keyword Tag Filtering**: 𣈯枤摮埈銵憛𠰴撱箸蝐斤祟 UI (pill-style 厰梹鞈靘 `/api/tags`)鸌摰𡁏蝐文嚗蝡臬葆 `tag` query 彍澆㙈敺𣬚垢 `get_keyword_ranking` SQL 賢嚗𧼮閰脫蝐斤鍂嗥𣈯枤摮㛖絞閮萄鞈瑕函 `fetchKeywords` 賢嚗𥟇蝐支孛潸隅Ｗ銵券啗乓
    - **WebSocket Dynamic Resolution**: `send_socket_event` resolves `bot_name` and `namespace` from `OAConfig`, defaulting to `websoc`. This ensures compatibility with both local and Heroku-hosted bot engines without hardcoding.
- **WebSocket Stability (Heroku)**: Uses single-namespace connection handshakes to avoid Heroku's multi-namespace connection failures.
- **Message Center UI Enhancements**:
  - Integrated `useToast` for reliable 5-second auto-hide notifications.
  - Implemented immediate state updates for tag addition/deletion to prevent UI lag.
  - **璅嗵惜滢峕郊讛摩 (Tag Operation Synchronization Logic)**: 撘訫 `pendingTagDeletionsRef`  `pendingTagAdditionsRef` (Mutable Ref) 餈質馱甇銁脰銝剔璅嗵惜滢
    - **墧閫湔鰵 (Non-Optimistic approach)**嚗𡁏覔帋蝙刻瘙蝘駁膄鈭喃耨寞𧋦 State 閫湔鰵讛摩𣶹函頂蝯望蝑匧 API 𣂼敺䕘灘孛 `fetchUsers` 齒鰵枏
    - **坔唾霅瑟 (Bilateral Timestamp Guarding)**嚗𡁏繧 10 蝘埝𤘪閮䀝霅瑟嗚訜 `fetchUsers` 頛芾岷𧼮隡箸刻蹱嚗峕芸閧嚗
        1. **芷膄霅瑟**嚗𡁏蕪 10 蝘鍦鋡怠⏛斤璅嗵惜
        2. **啣霅瑟**嚗䌊閗 10 蝘鍦啣雿撩滚膥撠𡁏𧊋湔鰵蝐扎
    - **銵𤘪**嚗𡁏𠳿皛輯雲鈭蝙刻䜘𣬚Ⅱ閮箏齒凒啜濱瘙器摨閗圾瘙箔懲蝡荔Line-Bot-Main嚗厰峕郊閧撱園撠舘稲蝐扎峕憭勗箇𣶹/箇𣶹憭晞濱閬𤥁死
    - **閬𤥁死見甇**嚗𡁏雿𣈯脰銝剔璅嗵惜⏛斗閙峕郊蝬剜 10 蝘垍蝛拙頁銝阡＊蝷箝⏛支葉齒蝷綽𣂷𡒊Ⅱ UX 漤
  - **𦠜銝剖蝛拙鍦璈筆 (Stable Sorting Mechanism)** [2026-04-13]:
    - **靽桀儔**嚗圾瘙箔懲讠鍂嗅厩㮾𣬚 `last_time` 撠舘稲 SQL 銝滢渡頝喳
    - **撖虫孵**嚗𡁜銁 `get_users_list`  `ORDER BY` 隤蘂銝剖 `user_id` 雿𦦵蝣箏抒蝚砌鍦箸嚗𣬚Ⅱ靽嘥銁峕艶瑟鰵 UI 雿濱蔭蝯訫蝛拙
  - **芸典啁靽桀儔 (Project & Timezone Sync Fix)** [2026-04-10]:
    - **峕郊璅∪**嚗𡁜瘨 UTC 頧㗇嚗祕𦦵雯撓乓坔澈脣＊蝷箝䔶雿濱擃𢛵濱啁璅∪耨敺拐 8 撠𤩺＊蝷箄瑁榆
    - **典啁璅∪ (Full Taiwan Time Mode)**嚗𡁶鈭泵蝙刻凒閬綽蝟餌絞冽鈭 UTC 頧㗇
    - **脣箸**嚗坔澈蝯曹脣 Naive Taiwan Datetime (銝滚鉄)
    - **摨誩硋**嚗𡁜蝡臬䂿策滨垢𤘪聢撘讐絞銝 `YYYY-MM-DD HH:mm:ss` ( `json_response`)嚗𣬚Ⅱ靽萘讛汗典銁隞颱銝钅撠閫箝峕𧋦唳瓐溻
    - **峕艶垍箸**嚗𡁏㕑䌊閙蝔綫剜栞蝞堒隞 `get_now_taiwan()` 箏抅皞𤥁鞈摨急枏朣𨳍
    - **懲冽峕郊**嚗𡁜亦鍂嗆 `cron_table.push_time`  `user_project_status.updated_at` (Joined At) ＊撘讐眏敺𣬚垢 Python 𣂷啁唾嚗諹屸 SQL `NOW()` 仿滚鞈摨思撩滚膥撠舘稲炊撌柴
  - **Flex 蝺刻摩券頛臬**:
    - **見甇**嚗𡁏繧 functional updates  `key` 齒頛㗇嗉圾瘙粹峕郊𣇉銝𠰴摰帋 Bug
    - **閬𤥁死皛輻**嚗𡁜 JSON 讛摩嚗𣬚宏文∠征憛𠺪撖衣𣶹迤遛閫
  - Resolved `ReferenceError`s caused by deprecated `showToast` calls.

### Visualization
- Uses `recharts` for LineCharts (Trend Analysis) and BarCharts (Keyword Ranking).
- Supports filtering by category (Message, Follow, User), tag selection, and group unit (Day/Week/Month/Year).
- Data export supported via CSV downloads in the global Statistics page.

## Image Upload Integration (𣇉銝𠰴游)

### Core Components
1. **Backend Endpoint**: `/api/upload/github` in `backend/endpoints/upload.py`.
   - Uses GitHub API to upload images as base64-encoded content.
   - **CDN Integration**: Returns `jsDelivr` CDN URLs (`https://cdn.jsdelivr.net/gh/...`) instead of raw GitHub URLs to ensure compatibility with LINE Bot API (avoids 400 errors).
    - **Configuration Storage**: Settings are retrieved from `permission_settings` (OAConfig) in the `other_settings` field (JSON). This ensures configuration persistence across Docker container rebuilds.
    - **冽雿滚撥嗆嵗撽 (Strict All-Field Validation)**: 箔蝣箔蝟餌絞贝湔改厰蝵格雿㵪鉄鞈摨怒INE API  GitHub 閮剖嚗厩𣶹典箏憛恬銝𥪜銁滨垢銵典鱓銝剖祕銵䎚
    - **撱園撽𡑒鞟內 (Deferred Validation)**: 箏𣇉楊頛舫撽梹蝟餌絞撟單銝齒𣂼憿舐內蝝鞟內嚗其蝙刻𨳍摮塩齒蓥⊿憭望齒 UI 銝𢠃＊埈蝷箏枂瞍誩‵𤌍嚗䔶誑蝣箔鞈娪𣪧 (`table:{appname}`) 賜摰峕㟲舐鍂扼
2. **Frontend UI**:
   - **FlexMessageEditor.jsx**: Integrated upload button for carousel/single bubbles.
   - **Projects.jsx (RichMessageModal)**: Added upload button for native `ImageSendMessage` types.
   - **AdminPage.js**: Provides management UI for GitHub settings within each OA configuration.
### Rich Menu Management (𡝗詨鱓蝞∠)
- **Frontend**: `RichMenu.jsx`.
    - Provide a list view to manage existing rich menus and aliases.
    - Features a visual editor for creating and modifying rich menu configurations.
    - Uses a canvas-based interface to define clickable areas (bounds) on a background image (scaled for preview).
    - Supports multiple action types: `message`, `uri`, `postback`, and `richmenuswitch` (for multi-page menus).
- **Backend**: `endpoints/richmenu.py`.
    - Directly proxies requests to the Line Messaging API to manage rich menus.
    - Handles metadata creation, image upload, alias management, and setting default menus.
    - Security: All requests are protected by `@token_required` and use the OA-specific `line_token` from `other_settings`.
    - **璅嗵惜甈𢠃抒恣䌊訫 (Tag-based Automation)** [2026-04-24]:
        - **懲摮睃**: 璅嗵惜桃撠齒靝脣 `OAConfig.other_settings['rich_menu_mappings']`
        - **敺𣬚垢閫貊䔄**: 撖虫 `check_and_update_rich_menu` 拇訜蝟餌絞菜葫 `set_tag` 誘嚗 `/api/trigger`  `/api/redirect`嚗㗇嚗峕瘥𥪜懲銵其蒂 LINE API 箇鍂嗅偦柴
        - **蝞∠隞钅𢒰**:  `RichMenu.jsx` 銝剜鰵憓𠺶峕鞉綉蝞～滚𣂷航𣇉閬誩蝺刻摩摮睃賬

### Broadcast Center (蝢斤䔄閮𦠜銝剖)
- **Frontend**: `Broadcast.jsx`.
    - 3-step wizard for creating broadcats.
    - `Step 1`: Audience selection (All, Tag, ID list) with real-time estimation.
    - `Step 2`: Message composition (up to 5 bubbles, supporting Text, Image, Video, Flex).
    - `Step 3`: Delivery scheduling (Immediate or Scheduled).
- **Backend**: `endpoints/broadcast.py`.
    - Manages `broadcasts` table.
    - Integrates with `QA_bank` for message storage and `cron_table` for scheduling.
    - Audience count logic uses `Private_var` for tag/all logic and calculates coverage ratio.
    - **㘾膄撠冽 (Excluding Blocked Users)**: 蝟餌絞刻蝞堒曆犖詨潮臬嚗峕瞈暹啁讠 `Unfollow` 鍂塚瘥𥪜 `history` 銝剔 `Follow`  `Unfollow` 鈭衤辣嚗㚁蝣箔冽偘桀隞灘蕭頩文孵董毺瘣餉憟賢
    - **Stability Pattern**: Uses a top-level `ErrorBoundary` to capture rendering exceptions and provide copyable stack traces. Employs defensive rendering guards (optional chaining, default values) for all derived data (stats, message summaries) and filters null messages from legacy data sequences.

### Rule Designer (瘜訫銵刻身閮) [2026-03-18 湔鰵]
- **Frontend**: `RuleDesigner.jsx`. (Route: `/ruledesigner`).
    - **皛輻銵冽聢蝺刻摩 (Inline Table Editor)**: 撠祉銝㗇撘譍ａ瑽讠憭扯”澆耦撘譌摮𡑒箸𧋦閮剖甈 (`state_in`, `content`, `note`, `state_out`, `tag`) 舀螱刻”澆抒凒仿𠹺耨嫘
    - **舀螱銋贝澈**: 蝯曹舀螱 `Q_bank` (詨閬)AD_bank` (蝞∠∟)  `QA_bank` (噼摨) 銋讠恣
    - **墧閮𦠜敶 (Modal)**: 撠𦦵 `msg_rpy` (墧閮𦠜) 蝺刻摩隞钅𢒰朖閬 (JourneyPreview) 賡𣪧箇崕蝡讠敶枂閬𣇉嚗𣬚Ⅱ靽肽”潛𧞄Ｘ㟲瞏𥪜憭勗縧鞱汗賢
    - **脣⏛**: 𣂷桀 `PUT`/`POST` 脣蠘 `DELETE` 厰
    - **𨅯鈭**: 隞滢坔抅潛鍂嗅蝔晞蝐方批捆朖瞈曉賬
- **Backend**: `endpoints/rule_designer.py`.
    - 蝯曹 API 閧 CRUD鰵憓 `AD_bank` 銋𧢲𣈲氬䌊閗坔澈 `msg_rpy` `json[]` 滚堒
    - **芸菟𥲤 (Auto-Debugging)**:  `create_rule`  `update_rule` 瘚銝剜㟲 `validate_rule_fields` 撽𡑒賣彍霅厰桀穿
        - `state_in` 䂿征瑼Ｘ䰻嚗㇋/AD_bank嚗剹
        - `msg_rpy`  `function` 銝滚虾峕箇征
        - `check`  `function` 甈 Python 隤墧撽𡑒嚗蝙 `ast.parse`嚗峕𣈲湧𡑒/憭𡁏挾撘讛瘜𤏪芸仿 `<%...%>` 璅⊥踎銵券撘𧶏
        - Message 憿𧼮 `content` 䂿征瑼Ｘ䰻
        - QA_bank  `tag` 䂿征瑼Ｘ䰻
    - **函隤墧撽𡑒蝡舫**: `POST /validate-syntax` 亙 `code`  `field` 彍嚗滨垢單隤墧瑼Ｘ䰻雿輻鍂

### 瘜訫銵券璅∪閮剛 (Dual-Mode Rule Designer) [2026-04-20]
- **蝪⊥璅∪ (Simple Mode)**嚗𡁜粹銵栞臭犖∟身閮
    - **甈梯**嚗𡁻黸 `state_in`, `state_out`, `check`, `function`, `type`, `history` 蝑匧極蝔见
    - **撠釣批捆**嚗𡁜憿舐內 `ID` (), `批捆 (content)`, `墧閮𦠜 (msg_rpy)`  `躰酉 (note)`
    - **鞱身血**嚗𡁜銁蝪⊥璅∪銝𧢲鰵憓噼嚗𣬚頂蝯望芸憛怠鞱身極蝔雿㵪憒 `state_in: ["*"]`嚗剹
- **撌亦璅∪ (Engineering Mode)**嚗𡁏靘𥕦湔雿齒綉塚身閮湛冽䲰蝎曄敦隤踵㟲𧢲頛臬ế瑯
- **UI 撖虫**嚗帋蝙 `designMode` 𧢲綉 Tab 嚗蒂閙擧蕪銵冽聢甈𠰴撠齒 `TableCellTextarea` 皜脫

### Database Viewer (鞈摨急炎閬)
- **Frontend**: `DatabaseViewer.jsx`. (Route: `/dbviewer`).
    - Dynamic data browser for all public tables and views.
    - Features: Chunked loading (300 rows/step), Search, Client-side caching.
- **Backend**: `endpoints/db_viewer.py`.
    - Provides metadata (table list) and data fetching with limit/offset and search capabilities.
    - Search is implemented using `ILIKE` across text-based columns.

## Environment Specific Configurations (啣孵濱蔭)

### yzulabuse 啣
- **鞈摨思耨甇**: 
    - `projects` 鞈銵典歇靽格迤箏 `project_id` SERIAL 銝駁枤嚗蒂閮剖鞱身 `type`
    - `project_schedules`  `cron_table` 撌脰朣 SERIAL 銝駁枤 (`schedule_id` / `task_id`)嚗圾瘙箇楊頛舀蝔閙 `null` 
- **Socket 瑁蝺鍦刻磰降芸**嚗𡁶鈭圾瘙粹雿萇䔄銝讠銝剜𪃾嚗ìsend_socket_event` 撌脤瑽讠瘙典 (Request-Scoped)齒芋撘譌甈∟矽函遣蝡讠崕蝡讠 Socket.IO 摰Ｘ蝡臬祕靘卝碶唾撓磰降嚗蝙 WebSocket 銝血銁憭望䌊訫 Polling嚗𣬚宏日撠 Heroku 撥園塚憿航𣂼鈭 `yzulabuse` 啣朞蝛拙扼
- **嘥 yzulabuse 鸌畾𡃏**嚗𡁜銁 `yzulabuse` 啣銝頁蝟餌絞撠 `OAConfig.other_settings` 剔 `socket_url`𥅾芾身摰𡄯閮剝𦻖 `https://yzulabuse.herokuapp.com`迨璈筆蝣箔鈭航甇Ⅱ頝舐眏唾府啣其犖隡箸剁踹 `5013` 啣瘛瑟蝡 `send_socket_event` 撌脣祕雿 OA Context 毺䰻璈笔嚗𣬚Ⅱ靽肽航寞 `X-OA-ID` 撠𤾸甇Ⅱ其犖撘閙嚗圾瘙箄炊撠𤾸 5013 憿䎚

### t峎[cuⅶP珜Bz瓡s [2026-04-24]
- **搢瑊z (Questionnaire)**:
    - **珖璁︿**: 珜Bz瓡q礎 ; set_tag|tag1|tag2 璁‧亄臟X Superpages 痐艉郱ギ ,pri_push('tag','tag1'),pri_push('tag','tag2') 璁。
    - **萛e妠**: _extract_tags_from_fn ④wsA銧周伀qs璁 pri_push P簧璁 set_tag 牷ATOJ搢玼鄍燜J^ UIC
- **菾坋{ (Projects)**:
    - **e搌A瑊zP繕e袨_**: 蚰F Projects.jsx  useTask A犍峇閬。N]aA蚞伬Pwq僂丶~]isProcessing, processingMessage ^麍訊犍 	askState HCo悃MFiJ菾坋{犰] ReferenceError 伬P React VY]繕e^DC

### 璅嗵惜辣瑚訫 [2026-04-24]
- **TagInput 辣**:
    - **鈭鍦擃娪芸**: 撖衣𣶹暺墧璅嗵惜頛詨獢捆其遙雿濱蝵株䌊閗 (Focus) 頛詨甈嚗圾瘙箏ế摰𡁜罸蝒憿䎚
    - **璅敺株矽**: 隤踵㟲頛詨獢摨虫誑蝣箔其摰寥𩑈摨虫暺墧毺銝湔扼
- **誩㭘蝞∠**:
    - **蠘靽桀儔**: 靽格迤 TagInput  Questionnaire.jsx 剔 Prop 濱迂銝滚龪滚憿 (selectedTags -> tags, setSelectedTags -> onChange)嚗峕敺拙瑕遣蝡鰵憓墧蝐文賬

### Flex 閮𦠜雿芸 [2026-04-24]
- **雿撠漤讛摩**: 
    - 嘥 Carousel 剔蝝𥪜㨃撘瑕鉄蝛箇 body  footer 摰孵膥嚗蒂 styles 閮剖嗉航𠧧嚗蒂瘨膄𣳇摨西䌊訫西𣬚𤩎毺鞱身質𠧧麄
- **鞱汗璅⊥挱**: 
    - JourneyPreview 蝯曉銁雿輻鍂 Flex 雿璅⊥挱 LINE 摨血朣𡃏綽蝣箔蝺刻摩其葉閬質蝡舐啁恍𢒰擃睃漲銝氬

### 𦠜銝剖綫剝頛臬 [2026-04-24]
- **𦠜銝剖擧蕪**: 典蝡 displayedMessages  ormatSidebarMessage 懲擧蕪嚗峕日鈭粹撠灘店頂蝯曹隞塚憒 postback嚗剹
- **Flex 𣇉峕艶**: 箏祆鰵憓  ackgroundColor 甈嚗蒂撠厩鍂潛鞟 Flex Bubble 璅銝哨仿啗憚剛閬箔湔扼

### 甇瑕蟮蝝縧滩憿𧼮ê̌芸 [2026-04-24]
- **駁讛摩**: 蝘駁膄 cronjobs.py 剔見  dd_history嚗峕㺿 maingame.py  lush_msg 擧挾寞鈭衤辣勗憿𧼮ê̌嚗ìys_push  sys_reply嚗剹
- **撠漤讛摩**: 撠 sys_push 蝝滚濱垢 isAdmin 斗𪃾嚗𣬚Ⅱ靽萘頂蝯望綫剛航璈笔膥鈭箏閬璅喲＊蝷箝

### 隞钅𢒰讛摩芸 [2026-04-24]
- **湧甈瞈**: 典蝡 /api/users  SQL 亥岷剖乩游𠂔潛 category 擧蕪璇苷辣嚗𣬚Ⅱ靽嘥椰湔桀蘨枏㗇蝢拍撠灘店批捆雿𦦵 last_message
- **Flex 桐璅⊥踎𣂼**: 靽格㺿 FlexMessageEditor.jsx  updateCurrentCard嚗訜璅⊥踎嚗	emplate嚗㗇嚗 map 撘瑕閬神匧㨃璅⊥踎閮剖嚗𣬚Ⅱ靽肽憚凋湔扼
### 圖文選單增強 (Rich Menu Enhancements) [2026-04-30]
- **動作類型簡化**: 移除 postback 動作類型，將「跳轉網頁」更名為「開啟連結」。
- **LIFF 標籤追蹤協議**: 
    - 支援在「開啟連結」動作中設定單一標籤。
    - 當設定標籤時，網址將自動轉換為 LIFF 代理格式：https://liff.line.me/2009851813-AgTeSa4r?bot={appname}&tag={標籤}&redirect={連結}。
    - {appname} 由 OA 設定中的 other_settings.app_name 提供。
    - 系統會自動解析現有的 LIFF 代理網址並還原標籤與原始連結供使用者編輯。

### 法則表簡易模式重構 (Rule Designer Simple Mode Redesign) [2026-04-30]
- **任務化儀表板**: 簡易模式由原本的滿版表格重構為「任務卡片」形式。
- **欄位語義化**: 
    - 標題: 對應 note 欄位。
    - 關鍵字: 對應 content 陣列（支援逗號分隔輸入）。
    - 生效期間: 對應 check 欄位中的 check_date_range('YYYY-MM-DD', 'YYYY-MM-DD')。
    - 每日時段: 對應 check 欄位中的 check_time_range('HH:mm', 'HH:mm')。
    - 完成標籤: 對應 function 欄位中的 update(f'set_tag|{標籤}')。
- **即時同步**: 編輯任務卡片會即時更新底層的工程欄位，確保資料結構的一致性。
- **雙模式切換**: 使用者可隨時切換至「工程模式」進行細節參數調整（如狀態轉移、複雜判斷式等）。

### 圖文選單與法則表自動化範例 [2026-04-30]
#### 1. 圖文選單 LIFF 標籤範例
- **情境**: 您希望知道有多少人點擊了選單中的「官網」按鈕。
- **設定**: 將連結設為 https://example.com，標籤設為「點擊官網」。
- **結果**: 系統生成的網址會包含標籤資訊。當用戶點擊時，系統會先在後台為該用戶標註「點擊官網」標籤，然後才跳轉至官網。這讓您可以在「客戶中心」直接篩選出所有點過官網的客戶。

#### 2. 法則表任務自動化範例
- **情境**: 建立一個自動領取優惠券的關鍵字回覆。
- **設定**: 
  - 標題: 領取開運優惠券
  - 關鍵字: 領取, 優惠券
  - 完成標籤: 已領取優惠券
- **結果**: 當用戶輸入「領取」或「優惠券」時，系統會回覆您設定好的圖文訊息（包含優惠券代碼或連結），並自動幫用戶貼上「已領取優惠券」標籤。未來您可以使用此標籤進行二次行銷（例如針對「未領取」的人再次發送）。

### 𡝗詨鱓憭𡁜董毺恣 [2026-05-04]
- **敺𣬚垢撖虫**: `backend/endpoints/richmenu.py` 啣 `/all` 舐眏嚗虾齒風雿輻鍂𣂼 OA 銝衣㬢硋𡝗詨鱓
- **滨垢撖虫**: `RichMenu.jsx` 啣撣唾銝𧢲詨鱓𣈲氬典董麄灘吔銝虫 OA 濱迂憿舐內
- **鞈蝯**:  `/all` 蝯哨瘥誩钅桃隞嗅璅躰酉 `oa_id`  `oa_name` 仿⏚滨垢

### 芸鞱汗讛摩靽格迤 [2026-05-05]
- **滨垢撖虫**: `frontend/src/pages/Projects.jsx` 剔 `JourneyPreview` 辣鞱汗讛摩靽格迤
- **霈𦠜凒蝝啁**: 靽格㺿 `computedPreviewSteps` 蝞埈䲮撘𧶏霈𤘪銝𧢲郊撽毺鞱潮橒靘萘滢甇仿嘑銵峕枏銝𢠃娍㯄脰蝝臬嚗𣬚Ⅱ靽嗪閬賣栞敺𣬚垢撖阡垍讛摩銝氬

### 2026-05-07 Frontend Background Preloading & Cache Layer
- **Global API Cache (rontend/src/api.js)**: 
  - 娍⏛ GET 嚗諹𥅾敹怠摮睃銁喳唾辷娍詨鱓嗅辣脰交栶
  - 嗅翰𤥁躰 5 蝘𡜐航孛 GET 湔鰵敹怠
  - 娍⏛ POST, PUT, DELETE 蝑劐耨寥嚗嘑銵芸皜膄典敹怠嚗𣬚Ⅱ靽肽蹱鰵擙桀漲
  -  App.jsx 嘥𡝗澆㙈 preloadPagesData(oaId)嚗峕拍 芸黎潸胯桃𢒰硋鞈

### Standardized Redirection & Tagging Flow [2026-05-08]
- **LIFF Redirection**: All outbound links that require tag assignment now utilize the centralized LIFF jump-site (`https://liff.line.me/2009851813-AgTeSa4r`).
- **Dynamic Context**: The system automatically injects the tenant's `app_name` (from OA config) and `oaId` into generated URLs.
- **Centralized Tracking**: Outbound links are routed through `/api/redirect` before reaching their final destination, ensuring consistent event logging and tenant isolation.
- **Automatic User ID**: Removed legacy `<%m.user_id%>` placeholders in favor of LIFF's native user profile retrieval, improving security and reliability.

## Database Connection Lifecycle (資料庫連線生命週期管理)

為了確保高併發下的系統穩定性，後端採用集中化的連線池管理策略。

### 1. 集中化管理模組 (`db_utils.py`)
所有手動 SQL 操作（非 SQLAlchemy 管理的部分）必須透過 `backend/db_utils.py` 提供的方法獲取連線。這解決了模組間的循環引用問題並統一了連線參數。

- **`get_main_db_connection()`**: 上限已優化為 **1**（針對 14 個專案共享 20 個連線的極端環境）。
- **`get_db_connection(db_url)`**: 上限優化為 **1**。
- **排隊機制**: 實作了 10 次重試（每次 0.5s）的等待邏輯。

### 2. 強制釋放規則 (Try-Finally Pattern)
所有 API Endpoint 必須遵循以下結構，以杜絕連線外洩 (Connection Leak)：
```python
from db_utils import get_db_connection
conn = None
try:
    conn = get_db_connection()
    # 執行操作...
finally:
    if conn: conn.close()
```

### 3. 例外處理與使用者體驗 (UX)
當連線池滿載時，系統會丟出 `Exception("系統繁忙，請稍後再試。")`。這取代了以往技術性的「Too many connections」錯誤，隱藏實作細節並提升使用者對繁忙狀態的包容度。

### 4. ORM 層配置 (SQLAlchemy)
用於 `OAConfig`、`User`、`Page` 等核心模型。
- **配置參數 (極限節能模式)**:
    - `poolclass`: `NullPool` (執行完立即釋放連線)
    - `pool_timeout`: 30

### 5. 中繼資料查詢優化 (Metadata Cache)
- **`_ENSURED_TABLES`**: 在 `broadcast.py` 中實作，快取已確認存在的租戶表格名稱，避免頻繁查詢 `information_schema` 造成資料庫效能下降。

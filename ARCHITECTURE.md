# Architecture Documentation

## System Overview
This project is a web application with a Flask backend and a React frontend. It manages users, projects, and scheduled events, integrating with a Socket.IO server for real-time communication.


## Scheduled Event Management (摰𡁏�閫貊䔄鈭衤辣 - Refactored)

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

### UI/UX �芸����摰寥�霅� (UI/UX Optimization & Content Validation) [2026-04-24]
- **閮𦠜�銝剖� (Message Center)**:
    - **���靽桀儔�� Skeleton �芸�**: �芸� `loadingUsers` ���衤��� Skeleton 憿舐內�讛摩嚗���典�憪贝��交��𨅯�蝯鞉��箇征��＊蝷綽��脫迫�芸�頛芾岷���蝐文��𥟇��箇𣶹�恍𢒰頝喳���
    - **璅嗵惜�啣��單��峕郊**: 撖虫�璅嗵惜�啣���⏛�文��� `fetchAvailableTags` �噼矽璈笔�嚗𣬚Ⅱ靽萘祟�詨��厰��賢朖����䭾�蝐斗�����𨰻��
- **�典�銵栞�蝯曹� (Standardization)**:
    - **�𡝗�閮𦠜� (Rich Message)**: 撠��蝟餌絞嚗���急���”��誨�剔䔄������臭葉敹��蝺刻摩�剁�銝剖��厩� "Flex Message" �� "Flex 閮𦠜�" 蝯曹��游��箝�������胯�㵪��𣂼��墧�銵栞��臭蝙�刻����蠘�����亙漲��
- **�𡝗��詨鱓 (Rich Menu)**:
    - **�𨅯����摨誩�撘�**: �典�銵刻��碶葉�游��峕�撠𧢲��㵪�銝血��鍦��箸��箏��� `richMenuId` �滚�嚗���啣銁�㵪�嚗峕���恣��之�誯��格���炎蝝Ｘ�����
- **璅嗵惜頛詨�獢� (TagInput Component)**:
    - **鈭鍦��文�蝭���芸�**: 隤踵㟲 `TagInput` ��辣�� `min-height` �� 48px 銝血��惩�頝嘅�閫�捱閫豢綉鋆萘蔭�㚚��𦠜��文����罸�蝒�����栞孛�潸撓�交��阡����憿䎚��
- **敺𣬚垢頨思遢撽𡑒� (Backend Security/Consistency)**:
    - **撱�偘閫貊䔄頨思遢蝞∠�**: 靽格迤蝡见朖�潮��誨�剜��� WebSocket 鈭衤辣 `user` ��彍��眏�笔��箏��� `yzuadmin` �寧� `system`嚗𣬚Ⅱ靽萘頂蝯梯䌊�閗孛�潛�閮𦠜�璅嗵惜銝齿�鋡怨炊�𡏭��喟恣��摱撣唾���
- **�典�隞餃����讠恣�� (Global Task State Persistence)** [2026-04-24]:
    - **TaskContext**: 撖虫��典� React Context嚗𣬚恣�� `isProcessing`��progress` �� `processingMessage`��
    - **UI �����**: 撠� `StatusIndicator` �祉宏�� `App.jsx` ����煺�撅�銝哨�閫�捱�諹䌊�閙�蝔卝�滚銁�臬��𡝗�摨𤩺��枏��𥕦����嚗屸�脣漲璇脲��删�隞嗅桊頛㕑�峕�憭梁��誯���
    - **隞餃��滨蔭**: �𣂷� `resetTask` �寞�嚗𣬚Ⅱ靽脲�雿𨅯��鞉�憭望�敺諹�甇�Ⅱ皜���典����卝��

### UI/UX �芸����摰寥�霅� (UI/UX Optimization & Content Validation) [2026-03-18]
- **�𡝗��詨鱓 (Rich Menu)**:
    - **頛匧�憭望��閧�**: ��𣪧銝餅��� (`/richmenu/`) ��ê̌�齿��� (`/richmenu/aliases`) �� API �航炊�娍⏛��𥅾銝餅��桀仃�梹�撠�覔�� HTTP ���讠Ⅳ�𣂷��琿��笔�嚗������芾身摰� LINE Token�㵪�嚗𥕦ê̌�齿��桀仃�堒��⊿�暺䁅����銝漤獈�钅��Ｖ蜓擃娍葡�瓐��
    - **銝𠰴��鞟內撘瑕�**: �澆��碶��喳��𡒊Ⅱ璅嗵內 `��1MB` ���獢�之撠誯��嗚��
- **閮𦠜�銝剖� (Message Center)**:
    - **�湧�甈���砍��� (Virtual Pagination)**: �嘥��冽�皜�鱓撖虫��箸䲰皛曉�鈭衤辣���蝡航��砍�����嗚���憪贝��� 15 蝑���嗡蝙�刻���銝𧢲��閗秐摨閖�����贝蕭�牐�銝�����辷��其�靽格㺿敺𣬚垢 API 蝯鞉�����𣂷�憭批��𣂼�皜脫�������憪贝��𡝗��𨰜��
- **�芸���� (Projects)**:
    - **璅嗵惜閬𤥁死�� (Tag Badges)**: �冽��訫��亦鍂�嗥�敶�枂閬𣇉� (`UserSelectModal`) 銝哨�敺拍鍂銝血��碶�璅嗵惜閫���讛摩 (`parseTags`)�����𧋦隞亙�銝脫𣄽�亙耦撘誩��曄��笔�璅嗵惜���嚗諹��𤤿��函����閫垍� pill/badge 璅����𣶹嚗峕����雿靝��Ｙ��渲��扼��

### UI/UX �芸����摰寥�霅� (UI/UX Optimization & Content Validation) [2026-03-10]
- **Loading ���讠恣��**: 
    - 撖虫� `Projects.jsx` 銝剔� `pageLoading` ���页��嗅��䜘�諹䌊�閙�蝔卝�滚�����詨�銝滚�撠�������孛�� `LoadingSpinner` 銝血銁 API �𧼮��齿�蝛箄��豢���
    - 蝣箔��冽��典��𥕦�獢��嚗峕�蝔见�銵刻�蝯梯��豢�銝齿��箇𣶹頝典�獢��畾条�憿舐內��
    - **蝡嗆�璇苷辣����蹱��嗘耨敺� (2026-03-30)**嚗�
        - �� `fetchSchedules` 銝剖��� `selectedProjectIdRef` 瘥𥪜��吔�蝣箔��唳郊�𧼮���𥅾撌脣��𥟇�蝔见�銝齿凒�啗�鞈����
        - �� JSX 皜脫�撅文� `schedules` �𡑒”撖行鴌 `filter(s => s.project_id == selectedProjectId)` 銋钅俈蝳行�折�瞈整��
- **�脤�閮𦠜�蝺刻摩�冽楛摨阡�霅�**: 
    - 撘瑕� `Projects.jsx` (RichMessageModal) �� `Broadcast.jsx` ���摮㗛�霅厰�頛胯��
    - 瘛勗漲閫�� Flex Message JSON 蝯鞉�嚗屸�撠齿��匧㨃�� (Bubbles) ���������𠰴�雿� (Hero Action)�滩��峕��訫�雿� (Footer Buttons)�漤�脰��䂿征瑼Ｘ䰻��
    - �仿��� (URI)����單�摮� (Text/Data) �箇征嚗𣬚頂蝯勗�����芸�摮䀝蒂�鞟內雿輻鍂���朣𨳍��
- **����冽��𡑒”�芸�**:
    - **�梁���陛瞏�**: 蝘駁膄銝餅��株��见��惩�皜�鱓銝剔� User ID 憿舐內嚗����＊蝷箔蝙�刻���蝔梧��亦���＊蝷箝�峕𧊋�賢��溻��
    - **璅嗵惜閫��**: �嘥��见��惩�敶�� (`UserSelectModal`) 銝剔�璅嗵惜憿舐內嚗�祕雿靝��澆捆 JSON List (`["A","B"]`) �� Pipe ���璅躰� (`|A|B|`) ��撥�亥圾�鞾�頛荔�蝣箔�璅嗵惜�賭��箇崕蝡𧢲�雿滨�閫���𣶹��

- **�脰遘銵𣬚���雿喳� (Message Center)**: �嘥� `MessageCenter.jsx` �� 7 蝘坿䌊�閗憚閰Ｘ凒�堆�撠𤾸�雿滨蔭靽肽風璈笔��� `isAtBottom` �箸��斗𪃾嚗諹圾瘙箇𧞄�Ｚ歲�閗��芸�銝𧢲��喳��函��唳曎��
- **撱�偘�鞱汗**: 撖虫��滨垢 `messages` �𡑒”�鞱汗�讛摩嚗峕��硋�憿噼��舐鸌敺蛛�Type Icon + ����芣𪃾嚗厰＊蝷箸䲰撱�偘甇瑕蟮皜�鱓銝准��

 ### User Tagging (�冽�璅躰酉)
 - **Flex Message Integration**: The Flex Message Editor allows users to associate multiple tags with button actions or image clicks.
 - **Protocol**: Tags are embedded in the `postback.data` payload using the `|set_tag|tag1|tag2|...` command suffix.
 - **Event Splitting (Simulation)**: For simulation/websocket triggers, the Superpages backend splits combined data into two events (Message + Postback) to ensure correct rule matching and tagging simultaneously.
 - **Frontend Component**: `TagInput.jsx` provides a dedicated UI for multi-tag selection with autocomplete support fetching from `/api/tags`.
 - **Rich Menu Extension**: 
    - **Tagging Support**: Rich Menu areas (Message, Postback, URI) now support multiple tags.
    - **Redirect Proxy Protocol**: When a URI action has tags, it is automatically converted to a proxy URL: `https://[BASE_URL]/api/redirect?url=[URL]&tags=[TAGS]`. The proxy logs the tags via WebSocket before redirecting the user.
    - **Prefix Protocol**: Message and Postback content for tagged buttons are stored with the `tag_true|tag1,tag2|content` prefix, allowing the rule engine to process tags via the `tag_true|*` rule matching.
 
### Lottery Management (�賜�蝞∠�)

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

### Message Center (閮𦠜�銝剖�)
- **Frontend**: `MessageCenter.jsx`.
  - Displays list of users and their chat history.
  - Supports sending messages and managing tags.
  - **�潮����䔄�脰風 (Anti-Double Send)**: 撖虫� `isSendingRef` (Ref Lock) �� `isSending` (State) 璈笔���訜�潮��葉����急�蝳�鍂頛詨�獢���厰�嚗䔶蒂�娍⏛敺𣬚��� Enter �菜�暺墧�鈭衤辣嚗屸俈甇ａ�銴�䔄����
  - **�芸����蝞∠� (Projects Management)**:
    - **閮𦠜�蝺刻摩�� (RichMessageModal)**: �舀螱����������蔣������唾� Flex 閮𦠜�����急�雿滚��游漲撽𡑒�嚗�俈甇Ｙ征�批捆嚗剹��
    - **�垍��讛摩**: 蝣箔� Step 0 雿𦦵����韏琿�銝滚虾�芷膄嚗𣬚雁霅瑟�蝔见��湔�扼��
    - **�冽�蝞∠� (UserSelectModal)**: �游� `/api/registered-users` �� `/api/tags`嚗峕𣈲�渲����嚗��蝔� + 璅嗵惜嚗㗇�撠页��𣂷�閬𤥁死�𡝗�蝐斤祟�豢綉�園���
  - **�誩㭘蝞∠� (Questionnaire)**:
    - **�誩㭘�芸�銝𦠜�蝐� (Auto-tagging)**: �舀螱�券��株身摰帋葉�惩�璅嗵惜��訜�冽��䂿�閰脤��格�嚗𣬚頂蝯望��誯�閬誩�摨思葉�� `function` 甈���瑁� `set_tag` ��誘嚗��撠齿�璅嗵惜�芸�璅躰酉�潸府�冽����蹱��拇䲰�單��閙��冽��誩末銝阡�脰���䔿��
    - **�閙����讠𤩎��**: 蝟餌絞�芸��Ｙ� `Q[ID][SEQ]` 璅∪�����卝��𥅾�毺鍂�𣬚�獢�炎�乓�㵪����憿滚��Ｙ�銝��贝歲頧㕑秐 `Q[ID]99` ���憿抒��卝��
    - **����𣂼��讛摩**: �拍鍂 `sys.now_between` �� `sys.now()` 瘥磰��讛摩嚗�銁�誩㭘�亙藁閬誩��� `check` 甈��銝剖祕�暹�畾萄ế�瑯��
    - **鞈�������**: 瘥譍�憿𣬚�蝑娍����誯� `pri_set` �脣��� `ans_{�誩㭘�滨迂}_Q{憿諹�}`嚗䔶蒂�典�憿折�畾菟�誯� `sys.pri_get` �閙�霈��硋��整��
  - **蝢斤䔄閮𦠜� (Broadcast)**:
    - **�潮���霅�**: �函䔄����脣��厩阮�漤�脰�瘛勗漲閮𦠜��批捆瑼Ｘ葫嚗���� Flex �抒��������訫�雿頣���
  - **�冽�皜�鱓�𨅯� (User List Search)**:
    - �𨅯�獢��摰� `searchQuery` state嚗屸�誯� debounce嚗�300ms嚗匧��潮�� API 隢𧢲�嚗峕𣈲�港� `user_id` ��蝙�刻���蝔望�撠卝��
    - �𨅯�獢���坔朖����斗��𤏪�X嚗剹��
  - **璅嗵惜蝭拚� (Tag Filtering)**:
    - 頛匧����匧虾�冽�蝐支蒂憿舐內�箏虾暺鮋����蝐斗��訫�銵剁��怒����具�漤������
    - 暺鮋�璅嗵惜敺䕘�隞� `tag` query parameter �喳� `/api/users`嚗���𧼮����閰脫�蝐斤��冽���
  - **敹怠�����讠恣�� (Cache & State Management)**:
    - 撠𤾸� `messagesCacheRef` 雿𦦵�����冽����閮䀹�擃𥪜翰�吔�雿踹�����𧼮歇�见����憭拙恕�賜��栞��亥�閮𦠜���
    - 蝯𣂼� `after` ����喟��峕艶頛芾岷嚗諹䌊�閗�朣𠰴翰�硋�����𤩺鰵閮𦠜�嚗�祕�暸妟蝑匧����蝮怠��偦�撽𨰜��
  - **�脰遘雿滨蔭蝞∠���俈頝喳� (Scroll Management)**:
    - **雿滨蔭����� (Scroll Persistence)**: 雿輻鍂 `userScrollPositionsRef` (Mutable Ref) 蝝�����讠鍂�嗥� `distanceFromBottom` �� `scrollTop`��
    - **�箸�蝵桀�����嗆�敺�**: ����冽�����交�憭扳䲰 100px ���銝𦠜㬢�閧�������敺� `scrollTop`嚗𥕦炏��嘑銵� `scrollToBottom`��
    - **�脰歲�訫�雿� (useLayoutEffect)**: �嗉��亙�擗䀹風�脰��荔��睲��鞾�嚗㗇�嚗�⏚�� `React.useLayoutEffect` �函�讛汗�券�蝜芸�閮�� `scrollHeight` 撌桀�潔蒂鋆𣈯� `scrollTop`嚗�祕�曇�閬箔����蝮怠�雿溻��
    - **蝛拙� DOM Key**: 閮𦠜��𡑒”雿輻鍂蝯𣂼� `timestamp` �� `index` ��帘摰𡁜�銝脖��� `key`嚗屸俈甇� React �冽凒�唳��瑟��滚遣 DOM 蝭�暺𧼮��湔㬢頠賊�憭晞��
  - **�𣇉�/慦㘾�頛匧��峕郊�� (LazyImage)**:
    - **�詨�璈笔�**: �箔�閫�捱�𧼮�甇亙�擃磰��亙��渡���𢒰�冽�嚗𡿨ayout Shift嚗㚁�撠𤾸� `LazyImage` ��辣���擃𥪜�隞嗅銁�讛汗�刻孛�� `onLoad` 摰峕�皜脫��㵪�撠�誑�勗耦���讠����雿齿�憿舐內嚗𣬚Ⅱ靽嘥捆�券�摨血銁�航��滚歇蝣箏���
    - **�單�蝵桀�**: 慦㘾�頛匧�摰𣬚佅敺䕘��� `isAtBottomRef` �箇�嚗��蝡见�隤輻鍂 `scrollToBottom`��
  ### 閮𦠜�銝剖����摰嫣誨�� (Message Center & Content Proxy)
�箔�蝣箔��賣迤撣賊＊蝷� LINE 隡箸�蝡舐�雿輻鍂���擃䈑�憒������蔣���嚗𣬚頂蝯勗祕雿靝�敺𣬚垢 Proxy 頝舐眏嚗�
- `/api/line/content/<message_id>`: ���撣嗅��孵董�毺� `line_token` 隢𧢲� LINE API 銝血��喃��脖�鞈����
- �滨垢雿輻鍂 `AuthenticatedImage` ��辣嚗屸�誯� `api.get` (撣嗆� JWT Token) �脣��批捆銝西��� Blob URL 憿舐內��
  - **撠滩店�批捆�𨅯� (Message Content Search)**:
    - �𠰴予摰支��寞��函��𨅯�獢���舀�撠讠訜�漤��函鍂�嗥�撠滩店�批捆��
    - 蝚血�����萄�隞仿��脰��舫�鈭桅＊蝷綽��誯� `highlightText` �賢�嚗㚁�銝阡＊蝷箇泵����詻��
  - **Message Display**:
    - Messages from `yzuadmin`, or with category `Sensor`, `Response`, or `sys_reply` are displayed on the right (Admin/System side).
    - `sys_reply` messages are displayed with rich content (text/image/video/audio/flex).
- **Backend**:
  - `GET /api/users`: �啣� `q`嚗���萄�嚗匧� `tag`嚗��蝐歹��亥岷��彍��
    - **瘛勗漲瑼Ｙ揣�讛摩**嚗䫤q` ��彍���撠� `user_id`����㵪�Private_var嚗㚁�隞亙� `history` 銵其葉���閰勗�摰嫘��
    - **Unicode 頧厩儔�閧�**嚗朞䌊�訫��𨅯��𣈯枤摮𡑒�蝢拍� `\uXXXX` 摨誩�嚗�蒂�脰��䠷�頧厩儔瘥𥪜�嚗㚁�蝣箔��賣�撠见� JSON �澆�銝剖�摮条� Unicode 蝺函Ⅳ銝剜�摮堒�摰嫘��
    - **QA_bank �游�**嚗朞𥅾 `history` �批捆�� QA 璅嗵惜嚗�� `cron|QA|...`嚗㚁���䌊�閗�蝯� `QA_bank` 銵冽�撠见�撠齿�����臬�摰對�`ans` �� `msg_rpy`嚗㚁��峕��舀螱 Unicode 頧厩儔瘥𥪜���
  - `GET /history/<user_id>`: �脣�����冽�����渲�憭拍�����

## Data Analysis & Statistics (�豢������絞閮�)

### Core Components
1. **Integrated Project Metrics**: Located within `Projects.jsx` -> `activeTab === 'schedules'`.
    - 憿舐內撠���孵����嚗𡁜��鞟� (completion_rate) �芸�憿舐內�潔��對��嗆活�箇蜇摰峕�甈⊥彍 (tcc)��孛�澆恥�嗆彍 (tc)�����/憭望��� (mss/msf)��
   - Metrics are filtered by the selected project and the specified date range.
2. **Global Account Analysis**: Located within `Statistics.jsx`.
    - **Trend Analysis**: Fetches grouped data from `/api/statistics`. (Global metrics: 蝮質��舫�, �啣�憟賢��� [鞈��摨� Follow], 撠��/閫�膄�� [鞈��摨� Unfollow], �㗇�憟賢��� [閰脫�畾萄�瘥𤩺𠯫瘣餉�鈭箸活])��
    - **Total Calculation**: The backend now also returns `total_counts` for the selected period. The "Effective Friend Count" card displays a strictly distinct user count for the entire duration, avoiding double-counting of recurring active users.
    - **Unfollow Tracking**: The Line-Bot engine captures `UnfollowEvent` and records it in history as an `Unfollow` category, which is then aggregated by the dashboard.
    - **Keyword Ranking**: Fetches data from `/api/statistics/keywords` (Top keyword rankings).
    - **Keyword Tag Filtering**: �𣈯枤摮埈�銵��憛𠰴�撱箸�蝐斤祟�� UI (pill-style �厰��梹�鞈��靘�� `/api/tags`)�����鸌摰𡁏�蝐文�嚗��蝡臬葆 `tag` query ��彍�澆㙈敺𣬚垢 `get_keyword_ranking` SQL �賢�嚗���𧼮�閰脫�蝐斤鍂�嗥��𣈯枤摮㛖絞閮�����萄�鞈���瑕��函��� `fetchKeywords` �賢�嚗���𥟇�蝐支���孛�潸隅�Ｗ�銵券��啗��乓��
    - **WebSocket Dynamic Resolution**: `send_socket_event` resolves `bot_name` and `namespace` from `OAConfig`, defaulting to `websoc`. This ensures compatibility with both local and Heroku-hosted bot engines without hardcoding.
- **WebSocket Stability (Heroku)**: Uses single-namespace connection handshakes to avoid Heroku's multi-namespace connection failures.
- **Message Center UI Enhancements**:
  - Integrated `useToast` for reliable 5-second auto-hide notifications.
  - Implemented immediate state updates for tag addition/deletion to prevent UI lag.
  - **璅嗵惜�滢��峕郊�讛摩 (Tag Operation Synchronization Logic)**: 撘訫� `pendingTagDeletionsRef` �� `pendingTagAdditionsRef` (Mutable Ref) 餈質馱甇�銁�脰�銝剔�璅嗵惜�滢���
    - **�墧�閫��湔鰵 (Non-Optimistic approach)**嚗𡁏覔�帋蝙�刻���瘙��蝘駁膄鈭���喃耨�寞𧋦�� State ���閫��湔鰵�讛摩��𣶹�函頂蝯望�蝑匧� API �𧼮��𣂼�敺䕘��滩孛�� `fetchUsers` �齿鰵�枏���
    - **�坔�����唾�霅瑟� (Bilateral Timestamp Guarding)**嚗𡁏繧�� 10 蝘埝��𤘪�閮䀝�霅瑟��嗚��訜 `fetchUsers` 頛芾岷�𧼮�隡箸��刻��蹱�嚗峕��芸��閧�嚗�
        1. **�芷膄霅瑟�**嚗𡁏蕪�� 10 蝘鍦�鋡怠⏛�斤�璅嗵惜��
        2. **�啣�霅瑟�**嚗朞䌊�閗��� 10 蝘鍦��啣�雿�撩�滚膥撠𡁏𧊋�湔鰵���蝐扎��
    - **��銵𤘪���**嚗𡁏𠳿皛輯雲鈭�蝙�刻����䜘�𣬚Ⅱ閮箏��齿凒�啜�滨���瘙����器摨閗圾瘙箔��惩�蝡荔�Line-Bot-Main嚗厰��峕郊�閧�撱園�撠舘稲���蝐扎�峕�憭勗��箇𣶹/�箇𣶹���憭晞�滨�閬𤥁死����誯���
    - **閬𤥁死���见�甇�**嚗𡁏�雿𣈯�脰�銝剔�璅嗵惜��⏛�斗��閙��峕郊蝬剜� 10 蝘垍�蝛拙����页�銝阡＊蝷箝��⏛�支葉�齿�蝷綽��𣂷��𡒊Ⅱ�� UX �漤���
  - **閮𦠜�銝剖�蝛拙��鍦�璈笔� (Stable Sorting Mechanism)** [2026-04-13]:
    - **�誯�靽桀儔**嚗朞圾瘙箔��惩��讠鍂�嗅��厩㮾�𣬚� `last_time` 撠舘稲 SQL �𧼮����銝滢��渡�頝喳��誯���
    - **撖虫��孵�**嚗𡁜銁 `get_users_list` �� `ORDER BY` 隤𧼮蘂銝剖��� `user_id` 雿𦦵�蝣箏��抒�蝚砌��鍦��箸�嚗𣬚Ⅱ靽嘥銁�峕艶�瑟鰵�� UI 雿滨蔭蝯訫�蝛拙���
  - **�芸�����典��啁����靽桀儔 (Project & Timezone Sync Fix)** [2026-04-10]:
    - **�峕郊���璅∪�**嚗𡁜�瘨� UTC 頧㗇�嚗�祕雿𦦵雯��撓�乓����坔澈�脣���＊蝷箝�䔶�雿滢�擃𢛵�滨��啁����璅∪���耨敺拐� 8 撠𤩺���＊蝷箄��瑁��誩榆��
    - **�典��啁����璅∪� (Full Taiwan Time Mode)**嚗𡁶�鈭�泵��蝙�刻��凒閬綽�蝟餌絞�冽�鈭� UTC 頧㗇���
    - **�脣��箸�**嚗朞��坔澈蝯曹��脣� Naive Taiwan Datetime (銝滚鉄���)��
    - **摨誩��硋���**嚗𡁜�蝡臬��䂿策�滨垢����𤘪聢撘讐絞銝��� `YYYY-MM-DD HH:mm:ss` (�誯� `json_response`)嚗𣬚Ⅱ靽萘�讛汗�典銁隞颱����銝钅�撠��閫���箝�峕𧋦�唳��瓐�溻��
    - **�峕艶�垍��箸�**嚗𡁏��㕑䌊�閙�蝔𧢲綫�剜��栞�蝞堒�隞� `get_now_taiwan()` �箏抅皞𤥁�鞈��摨急��枏�朣𨳍��
    - **�惩��冽�����峕郊**嚗𡁜��亦鍂�嗆��� `cron_table.push_time` �� `user_project_status.updated_at` (Joined At) ��＊撘讐眏敺𣬚垢 Python �𣂷��啁�����唾�嚗諹�屸��誯� SQL `NOW()` 隞仿��滚�鞈��摨思撩�滚膥���撠舘稲��炊撌柴��
  - **Flex 蝺刻摩�券�頛臬���**:
    - **���见�甇�**嚗𡁏繧�� functional updates �� `key` �齿�頛㗇��嗉圾瘙粹��峕郊�𣇉�銝𠰴�摰帋� Bug��
    - **閬𤥁死皛輻�**嚗𡁜��� JSON ����讛摩嚗𣬚宏�文�����∠���征��憛𠺪�撖衣𣶹��迤��遛���閫���
  - Resolved `ReferenceError`s caused by deprecated `showToast` calls.

### Visualization
- Uses `recharts` for LineCharts (Trend Analysis) and BarCharts (Keyword Ranking).
- Supports filtering by category (Message, Follow, User), tag selection, and group unit (Day/Week/Month/Year).
- Data export supported via CSV downloads in the global Statistics page.

## Image Upload Integration (�𣇉�銝𠰴��游�)

### Core Components
1. **Backend Endpoint**: `/api/upload/github` in `backend/endpoints/upload.py`.
   - Uses GitHub API to upload images as base64-encoded content.
   - **CDN Integration**: Returns `jsDelivr` CDN URLs (`https://cdn.jsdelivr.net/gh/...`) instead of raw GitHub URLs to ensure compatibility with LINE Bot API (avoids 400 errors).
    - **Configuration Storage**: Settings are retrieved from `permission_settings` (OAConfig) in the `other_settings` field (JSON). This ensures configuration persistence across Docker container rebuilds.
    - **�冽�雿滚撥�嗆嵗撽� (Strict All-Field Validation)**: �箔�蝣箔�蝟餌絞�贝�����湔�改����厰�蝵格�雿㵪���鉄鞈��摨怒��INE API �� GitHub 閮剖�嚗厩𣶹�典��箏�憛恬�銝𥪜銁�滨垢銵典鱓銝剖祕銵䎚��
    - **撱園�撽𡑒��鞟內 (Deferred Validation)**: �箏��𣇉楊頛舫�撽梹�蝟餌絞撟單�銝齿��𣂼�憿舐內蝝���鞟內嚗���其蝙�刻����𨳍���摮塩�齿��蓥��⊿�憭望�����齿��� UI 銝𢠃＊�埈�蝷箏枂瞍誩‵��𤌍嚗䔶誑蝣箔�鞈���娪𣪧�� (`table:{appname}`) ����賜�摰峕㟲�舐鍂�扼��
2. **Frontend UI**:
   - **FlexMessageEditor.jsx**: Integrated upload button for carousel/single bubbles.
   - **Projects.jsx (RichMessageModal)**: Added upload button for native `ImageSendMessage` types.
   - **AdminPage.js**: Provides management UI for GitHub settings within each OA configuration.
### Rich Menu Management (�𡝗��詨鱓蝞∠�)
- **Frontend**: `RichMenu.jsx`.
    - Provide a list view to manage existing rich menus and aliases.
    - Features a visual editor for creating and modifying rich menu configurations.
    - Uses a canvas-based interface to define clickable areas (bounds) on a background image (scaled for preview).
    - Supports multiple action types: `message`, `uri`, `postback`, and `richmenuswitch` (for multi-page menus).
- **Backend**: `endpoints/richmenu.py`.
    - Directly proxies requests to the Line Messaging API to manage rich menus.
    - Handles metadata creation, image upload, alias management, and setting default menus.
    - Security: All requests are protected by `@token_required` and use the OA-specific `line_token` from `other_settings`.
    - **璅嗵惜甈𢠃��抒恣��䌊�訫���� (Tag-based Automation)** [2026-04-24]:
        - **�惩�摮睃�**: 璅嗵惜����桃�撠齿��靝��脣��� `OAConfig.other_settings['rich_menu_mappings']`��
        - **敺𣬚垢閫貊䔄**: 撖虫� `check_and_update_rich_menu` �拇���訜蝟餌絞�菜葫�� `set_tag` ��誘嚗��誯� `/api/trigger` �� `/api/redirect`嚗㗇�嚗峕�瘥𥪜��惩�銵其蒂�誯� LINE API �箇鍂�嗅��偦��柴��
        - **蝞∠�隞钅𢒰**: �� `RichMenu.jsx` 銝剜鰵憓𠺶�峕��鞉綉蝞～�滚�����𣂷��航��𣇉�閬誩�蝺刻摩���摮睃��賬��

### Broadcast Center (蝢斤䔄閮𦠜�銝剖�)
- **Frontend**: `Broadcast.jsx`.
    - 3-step wizard for creating broadcats.
    - `Step 1`: Audience selection (All, Tag, ID list) with real-time estimation.
    - `Step 2`: Message composition (up to 5 bubbles, supporting Text, Image, Video, Flex).
    - `Step 3`: Delivery scheduling (Immediate or Scheduled).
- **Backend**: `endpoints/broadcast.py`.
    - Manages `broadcasts` table.
    - Integrates with `QA_bank` for message storage and `cron_table` for scheduling.
    - Audience count logic uses `Private_var` for tag/all logic and calculates coverage ratio.
    - **�㘾膄撠���冽� (Excluding Blocked Users)**: 蝟餌絞�刻�蝞堒��曆犖�詨��潮����臬�嚗峕����瞈暹����啁��讠� `Unfollow` ��鍂�塚�瘥𥪜� `history` 銝剔� `Follow` �� `Unfollow` 鈭衤辣嚗㚁�蝣箔��冽偘������桀�隞滩蕭頩文��孵董�毺�瘣餉�憟賢���
    - **Stability Pattern**: Uses a top-level `ErrorBoundary` to capture rendering exceptions and provide copyable stack traces. Employs defensive rendering guards (optional chaining, default values) for all derived data (stats, message summaries) and filters null messages from legacy data sequences.

### Rule Designer (瘜訫�銵刻身閮�) [2026-03-18 �湔鰵]
- **Frontend**: `RuleDesigner.jsx`. (Route: `/ruledesigner`).
    - **皛輻�銵冽聢蝺刻摩�� (Inline Table Editor)**: 撠���祉�銝㗇�撘譍��ａ�瑽讠�憭扯”�澆耦撘譌���摮𡑒��箸𧋦閮剖�甈�� (`state_in`, `content`, `note`, `state_out`, `tag`) �舀螱�刻”�澆��抒凒�仿��𠹺耨�嫘��
    - **�舀螱銋贝���澈**: 蝯曹��舀螱 `Q_bank` (�詨�閬誩�)��AD_bank` (蝞∠��∟���) �� `QA_bank` (�噼�摨�) 銋讠恣����
    - **�墧�閮𦠜�敶�� (Modal)**: 撠���𦦵� `msg_rpy` (�墧�閮𦠜����) 蝺刻摩隞钅𢒰��朖���閬� (JourneyPreview) �賡𣪧�箇崕蝡讠�敶�枂閬𣇉�嚗𣬚Ⅱ靽肽”�潛𧞄�Ｘ㟲瞏𥪜����憭勗縧�鞱汗�賢���
    - **�脣���⏛��**: �𣂷��桀��� `PUT`/`POST` �脣��蠘��� `DELETE` �厰���
    - **�𨅯����鈭�**: 隞滢��坔抅�潛鍂�嗅�蝔晞���蝐方��批捆��朖���瞈曉��賬��
- **Backend**: `endpoints/rule_designer.py`.
    - 蝯曹� API �閧� CRUD��鰵憓� `AD_bank` 銋𧢲𣈲�氬��䌊�閗�����坔澈�� `msg_rpy` `json[]` ����滚��堒���
    - **�芸��菟𥲤 (Auto-Debugging)**: �� `create_rule` �� `update_rule` 瘚��銝剜㟲�� `validate_rule_fields` 撽𡑒��賣彍���霅厰��桀��穿�
        - `state_in` �䂿征瑼Ｘ䰻嚗㇋/AD_bank嚗剹��
        - `msg_rpy` �� `function` 銝滚虾�峕��箇征��
        - `check` �� `function` 甈���� Python 隤墧�撽𡑒�嚗�蝙�� `ast.parse`嚗峕𣈲�湧�𡑒�/������憭𡁏挾撘讛�瘜𤏪��芸��仿� `<%...%>` 璅⊥踎銵券�撘𧶏���
        - Message 憿𧼮��� `content` �䂿征瑼Ｘ䰻��
        - QA_bank �� `tag` �䂿征瑼Ｘ䰻��
    - **�函�隤墧�撽𡑒�蝡舫�**: `POST /validate-syntax` �亙� `code` �� `field` ��彍嚗䔶��滨垢�單�隤墧�瑼Ｘ䰻雿輻鍂��

### 瘜訫�銵券�璅∪�閮剛� (Dual-Mode Rule Designer) [2026-04-20]
- **蝪⊥�璅∪� (Simple Mode)**嚗𡁜��粹���銵栞��臭犖�∟身閮���
    - **甈���梯�**嚗𡁻黸�� `state_in`, `state_out`, `check`, `function`, `type`, `history` 蝑匧極蝔见��詻��
    - **撠�釣�批捆**嚗𡁜�憿舐內 `ID` (�航�), `�批捆 (content)`, `�墧�閮𦠜� (msg_rpy)` �� `�躰酉 (note)`��
    - **�鞱身鞈血��**嚗𡁜銁蝪⊥�璅∪�銝𧢲鰵憓噼����嚗𣬚頂蝯望��芸�憛怠��鞱身��極蝔𧢲�雿㵪�憒� `state_in: ["*"]`嚗剹��
- **撌亦�璅∪� (Engineering Mode)**嚗𡁏�靘𥕦��湔�雿齿綉�塚������身閮���湛��冽䲰蝎曄敦隤踵㟲���𧢲����頛臬ế�瑯��
- **UI 撖虫�**嚗帋蝙�� `designMode` ���𧢲綉�� Tab ���嚗䔶蒂�閙��擧蕪銵冽聢甈���𠰴�撠齿��� `TableCellTextarea` 皜脫���

### Database Viewer (鞈��摨急炎閬�)
- **Frontend**: `DatabaseViewer.jsx`. (Route: `/dbviewer`).
    - Dynamic data browser for all public tables and views.
    - Features: Chunked loading (300 rows/step), Search, Client-side caching.
- **Backend**: `endpoints/db_viewer.py`.
    - Provides metadata (table list) and data fetching with limit/offset and search capabilities.
    - Search is implemented using `ILIKE` across text-based columns.

## Environment Specific Configurations (�啣��孵��滨蔭)

### yzulabuse �啣�
- **鞈��摨思耨甇�**: 
    - `projects` 鞈��銵典歇靽格迤�箏��� `project_id` SERIAL 銝駁枤嚗䔶蒂閮剖��鞱身 `type`��
    - `project_schedules` �� `cron_table` 撌脰�朣� SERIAL 銝駁枤 (`schedule_id` / `task_id`)嚗諹圾瘙箇楊頛舀�蝔𧢲��� `null` �航炊�誯���
- **Socket ����瑁�蝺鍦��刻��磰降�芸�**嚗𡁶�鈭�圾瘙粹�雿萇䔄銝讠����銝剜𪃾�誯�嚗䈣send_socket_event` 撌脤�瑽讠��諹�瘙���典� (Request-Scoped)�齿芋撘譌���甈∟矽�函���遣蝡讠崕蝡讠� Socket.IO 摰Ｘ�蝡臬祕靘卝�������碶��唾撓�磰降嚗����蝙�� WebSocket 銝血銁憭望���䌊�訫����� Polling嚗𣬚宏�日�撠� Heroku ��撥�園��塚�憿航��𣂼�鈭� `yzulabuse` �啣����朞�蝛拙��扼��
- **�嘥� yzulabuse ��鸌畾𡃏���**嚗𡁜銁 `yzulabuse` �啣�銝页�蝟餌絞������撠� `OAConfig.other_settings` 銝剔� `socket_url`��𥅾�芾身摰𡄯����閮剝��𦻖�� `https://yzulabuse.herokuapp.com`��迨璈笔�蝣箔�鈭���航�甇�Ⅱ頝舐眏�唾府�啣�����其犖隡箸��剁��踹��� `5013` �啣�瘛瑟����蝡� `send_socket_event` 撌脣祕雿� OA Context �毺䰻璈笔�嚗𣬚Ⅱ靽肽��航��寞� `X-OA-ID` 撠𤾸�甇�Ⅱ����其犖撘閙�嚗諹圾瘙箄炊撠𤾸��� 5013 ���憿䎚��

### t峎[cuⅶP珜Bz瓡s [2026-04-24]
- **搢瑊z (Questionnaire)**:
    - **珖璁︿**: 珜Bz瓡q礎 ; set_tag|tag1|tag2 璁‧亄臟X Superpages 痐艉郱ギ ,pri_push('tag','tag1'),pri_push('tag','tag2') 璁。
    - **萛e妠**: _extract_tags_from_fn ④wsA銧周伀qs璁� pri_push P簧璁� set_tag 牷ATOJ搢玼鄍燜J^ UIC
- **菾坋�{ (Projects)**:
    - **e搌A瑊zP繕e袨_**: 蚰F Projects.jsx  useTask A犍峇閬。N]aA蚞伬Pwq僂丶~]isProcessing, processingMessage ^麍訊犍 	askState HCo悃MFiJ菾坋�{犰] ReferenceError 伬P React VY]繕e^DC

### 璅嗵惜��辣����瑚��訫��� [2026-04-24]
- **TagInput ��辣**:
    - **鈭鍦�擃娪��芸�**: 撖衣𣶹暺墧�璅嗵惜頛詨�獢�捆�其遙雿蓥�蝵株䌊�閗��� (Focus) 頛詨�甈��嚗諹圾瘙箏ế摰𡁜��罸�蝒��憿䎚��
    - **璅��敺株矽**: 隤踵㟲頛詨�獢��摨虫誑蝣箔��其����摰寥𩑈摨虫�暺墧����毺�銝��湔�扼��
- **�誩㭘蝞∠�**:
    - **�蠘�靽桀儔**: 靽格迤 TagInput �� Questionnaire.jsx 銝剔� Prop �滨迂銝滚龪�滚�憿� (selectedTags -> tags, setSelectedTags -> onChange)嚗峕�敺拙��瑕遣蝡𧢲���鰵憓墧�蝐文��賬��

### Flex 閮𦠜�雿���芸� [2026-04-24]
- **雿��撠漤��讛摩**: 
    - �嘥� Carousel 銝剔�蝝𥪜���㨃���撘瑕���鉄蝛箇� body �� footer 摰孵膥嚗䔶蒂�誯� styles 閮剖��嗉��航𠧧嚗䔶誑瘨�膄�𣳇�摨西䌊�訫��西�𣬚𤩎�毺��鞱身�質𠧧���麄��
- **�鞱汗璅⊥挱���**: 
    - JourneyPreview 蝯�辣�曉銁雿輻鍂 Flex 雿��璅⊥挱 LINE ���摨血�朣𡃏��綽�蝣箔�蝺刻摩�其葉���閬質��𧢲�蝡舐��啁��恍𢒰擃睃漲銝��氬��

### 閮𦠜�銝剖���綫�剝�頛臬��� [2026-04-24]
- **閮𦠜�銝剖��擧蕪**: �典�蝡� displayedMessages �� ormatSidebarMessage �惩�����擧蕪嚗峕��日�鈭粹�撠滩店��頂蝯曹�隞塚�憒� postback嚗剹��
- **Flex �𣇉��峕艶**: �箏�����祆鰵憓� ackgroundColor 甈��嚗䔶蒂撠���厩鍂�潛��鞟� Flex Bubble 璅��銝哨�隞仿��啗憚�剛�閬箔��湔�扼��

### 甇瑕蟮蝝���縧�滩�憿𧼮ê̌�芸� [2026-04-24]
- **�駁��讛摩**: 蝘駁膄 cronjobs.py 銝剔��见� dd_history嚗峕㺿�� maingame.py �� lush_msg �擧挾�寞�鈭衤辣靘���閙�瘙箏�憿𧼮ê̌嚗ìys_push �� sys_reply嚗剹��
- **撠漤��讛摩**: 撠� sys_push 蝝滚��滨垢 isAdmin �斗𪃾嚗𣬚Ⅱ靽萘頂蝯望綫�剛��航�璈笔膥鈭箏�閬��璅���喲＊蝷箝��

### 隞钅𢒰�讛摩�芸� [2026-04-24]
- **�湧�甈��瞈�**: �典�蝡� /api/users �� SQL �亥岷銝剖��乩��游𠂔�潛� category �擧蕪璇苷辣嚗𣬚Ⅱ靽嘥椰�湔��桀蘨�枏��㗇�蝢拍�撠滩店�批捆雿𦦵� last_message��
- **Flex �桐�璅⊥踎�𣂼�**: 靽格㺿 FlexMessageEditor.jsx �� updateCurrentCard嚗𣬚訜���璅⊥踎嚗�	emplate嚗㗇�嚗�����誯� map 撘瑕�閬�神���匧㨃���璅⊥踎閮剖�嚗𣬚Ⅱ靽肽憚�凋��湔�扼��
# #   [ 2 0 2 6 - 0 4 - 2 7 ]   U I / U X   9eU 
 -   * * R u l e D e s i g n e r * * :   !|f!j_Nf�ehkMOT1z  ( Y:   c o n t e n t   - >   O(u8eQ,   n o t e   - >   P;f,   m s g _ r p y   - >   V
o`) XRd\Ov'`0 
 -   * * F l e x M e s s a g e E d i t o r * * :   [\O*d!j_Nv!jg7_6Rq} N_j6R&N\!jgxdhVy*daSGrc6RR
NeMQO(u(um-d!jg\Hrb/N0 
 
### UI/UX �孵����蝔钅�閬賢�撘� [2026-04-27]
- **�鞱汗�箸����**: �刻䌊�閙�蝔讠��鞱汗閬𣇉� (Projects.jsx) 銝剖��亙抅皞𡝗��栞身摰𡁏��� (previewBaseTime state)嚗�虾�閙�撠� interval_hours (隞亙����) 頧㗇��箏祕�𤤿��鞱��潮����瓐��
- **�垍��芸�**: JourneyPreview �舀螱�𥡝�憿舐內������閮���橒�霈𤘪�蝔见虾閬𡝗�批之撟��擃塩��
- **閮𦠜��䁅�蝎曄陛**: 閮𦠜�銝剖�皜�鱓 (MessageCenter.jsx) �嘥� flex 閮𦠜�嚗𣬚凒�仿＊蝷箇��������胯�滚縧�文�擗䀹𡠺���霈梶𧞄�Ｘ凒�牐嗾瘛具��

### �啣�璅∠�嚗𡁜恥�嗡葉敹� (Customer Center) [2026-04-28]
- **�滨垢撖虫�**嚗�rontend/src/pages/CustomerCenter.jsx嚗峕�靘𥕦恥�嗅�銵具��恥蝢斗��株�璅嗵惜蝞∠���絞銝�隞钅𢒰��
- **敺𣬚垢撖虫�**嚗�ackend/endpoints/customers.py �𣂷� /api/customers (�𡁜� private_var �� history) 隞亙� /api/customers/groups (敺� private_var ��� g_group ��絞閮����)��
- **頝舐眏**嚗𡁏㟲��秐 App.jsx 銝虫誑 CustomerCenter ��𢒰�滨迂撠齿�頝臬� /oa/:oaId/customers��


### 摰Ｘ�銝剖��脤��蠘���黎�潭㟲�� (Customer Center Enhanced) [2026-04-28]
- **�滨垢�嗆�**嚗鋴ustomerCenter.jsx �惩�憭折��詨����� (selectedUserIds)��恥蝢方�璅嗵惜���雿� Modal��祕雿𡏭� Broadcast.jsx ��楊��𢒰���见��� (location.state)��
- **敺𣬚垢�游�**嚗䬙ustomers.py 銝� /groups 蝡舫��游��舀螱霈�撖� Global_var �� group_descriptions嚗䔶蒂撖虫��寞活�湔鰵 Private_var g_group �� POST �讛摩��

- **璅嗵惜蝞∠� (Tag Management)**: �舀螱�寞活璅嗵惜�滢�����笔⏛�斗��嗚��
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

### �𡝗��詨鱓憭𡁜董�毺恣������ [2026-05-04]
- **敺𣬚垢撖虫�**: `backend/endpoints/richmenu.py` �啣� `/all` 頝舐眏嚗�虾�齿風雿輻鍂����𣂼����� OA 銝衣㬢�硋��𡝗��詨鱓��
- **�滨垢撖虫�**: `RichMenu.jsx` �啣�撣唾����銝𧢲��詨鱓��𣈲�氬����典董�麄�滩��吔�銝虫��� OA �滨迂�脰����憿舐內��
- **鞈��蝯鞉�**: �� `/all` �𧼮�蝯鞉�銝哨�瘥誩�钅��桃�隞嗅�璅躰酉 `oa_id` �� `oa_name` 隞亙⏚�滨垢�����

### �芸�����鞱汗�讛摩靽格迤 [2026-05-05]
- **�滨垢撖虫�**: `frontend/src/pages/Projects.jsx` 銝剔� `JourneyPreview` ��辣�鞱汗�讛摩靽格迤��
- **霈𦠜凒蝝啁�**: 靽格㺿 `computedPreviewSteps` ���蝞埈䲮撘𧶏�霈𤘪�銝��𧢲郊撽毺��鞱��潮����橒�靘萘��滢�甇仿���嘑銵峕��枏�銝𢠃��娍��㯄�脰�蝝臬�嚗𣬚Ⅱ靽嗪�閬賣��栞�敺𣬚垢撖阡��垍��讛摩銝��氬��

### 2026-05-07 Frontend Background Preloading & Cache Layer
- **Global API Cache (rontend/src/api.js)**: 
  - �娍⏛���� GET 隢𧢲�嚗諹𥅾敹怠�摮睃銁����喳��唾��辷��娍�����詨鱓�嗅辣�脰��交��栶��
  - �嗅翰�𤥁��躰��� 5 蝘𡜐�����航孛�� GET 隢𧢲��湔鰵敹怠���
  - �娍⏛ POST, PUT, DELETE 蝑劐耨�寥�隢𧢲�嚗�嘑銵���芸�皜�膄�典�敹怠�嚗𣬚Ⅱ靽肽��蹱鰵擙桀漲��
  - �� App.jsx �嘥��𡝗��澆㙈 preloadPagesData(oaId)嚗峕��拍� �芸������黎�潸��胯�������桃���𢒰�硋�鞈����

### Standardized Redirection & Tagging Flow [2026-05-08]
- **LIFF Redirection**: All outbound links that require tag assignment now utilize the centralized LIFF jump-site (`https://liff.line.me/2009851813-AgTeSa4r`).
- **Dynamic Context**: The system automatically injects the tenant's `app_name` (from OA config) and `oaId` into generated URLs.
- **Centralized Tracking**: Outbound links are routed through `/api/redirect` before reaching their final destination, ensuring consistent event logging and tenant isolation.
- **Automatic User ID**: Removed legacy `<%m.user_id%>` placeholders in favor of LIFF's native user profile retrieval, improving security and reliability.

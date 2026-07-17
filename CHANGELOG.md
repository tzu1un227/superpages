## [2026-07-16] 效能優化：圖文選單排程與伺服器負載
- **優化 (backend/endpoints/richmenu.py)**: 在 `check_and_apply_scheduled_rich_menus` 中加入 `_LAST_ACTIVE_RESTRICTED_MENUS` 快取機制，只在「有排程選單生效或過期」時才觸發耗時的 `bulk_check_and_update_rich_menu` 全體比對，以解決每 60 秒頻繁掃描全體用戶導致資料庫連線過載與 Error 503 的問題。

## [2026-07-16] 法則編輯器 Bug 修復
- **修正 (backend/endpoints/rule_designer.py)**: 修正建立法則時發生雙重建立的問題。
- **修正 (backend/endpoints/rule_designer.py)**: 修正取得法則列表時因 dictionary key 未字串化導致 Unhashable type 的問題。

## [2026-07-15] 雙軌法則機制 Bug 修復 (Issue #31)
- **修正 (backend/endpoints/rule_designer.py)**: 修正建立、刪除法則時，無法正確同步 Sensor 法則的問題 (原本誤用 category 與 msg_in 欄位，現已修正為 type 與 content 欄位)。
- **修正 (frontend/src/components/FlexMessageEditor.jsx)**: 修正當按鈕未綁定標籤時產生的 sys_bind 格式會導致 Webhook 解析發生 SyntaxError 的問題，將空的標籤字串改為 []。

## [2026-07-15] 圖文訊息預覽與按鈕觸發機制修正 (Issue #31)
- **修正 (frontend/src/components/FlexMessageEditor.jsx)**: 修正圖文訊息標題無法換行 (wrap: true) 與標題/說明文字間距過小的排版問題。
- **修改 (frontend/src/components/FlexMessageEditor.jsx)**: 統一所有訊息按鈕的 Postback 格式為 sys_bind|...|實際文字，讓後端能有一致的解析格式。
- **修改 (backend/endpoints/rule_designer.py)**: 在建立、更新、刪除關鍵字回覆 (Message) 法則時，同步處理對應的 Sensor 法則 (雙軌法則機制)，以解決圖文訊息隱藏按鈕無法觸發關鍵字的問題。

## [2026-07-07] 詨桅航炊靽桀儔 (Issue #19) - Part 3
- **敺蝡 (ackend/endpoints/richmenu.py)**: 靽格迤 /richmenu  /richmenu/all API 芸 end_time 憿嚗撠游蝡 FlexMessageEditor (憒芸蝔閮剖) 典閰阡瞈曉歇蝯詨格蝻箏鞈憭望曉 API 撌脫甇亙 end_time

## [2026-07-07] 詨桅航炊靽桀儔 (Issue #19) - Part 2
- **蝡 (rontend/src/components/FlexMessageEditor.jsx)**:  Flex 閮舐楊頛臬函暺暺銝詨桐葉嚗銝瞈曉歇詨桃頛胯
- **敺蝡 (ackend/endpoints/richmenu.py)**: 靽格迤 ulk_check_and_update_rich_menu 典瑼Ｘ交嚗撘瑕嗉圾扎喲詨柴冽嗥摰 Bug嚗望撠冽嗥嗅 
ich_menu 靘頝喲閮剖冽嗚

## [2026-07-07] 詨桅航炊靽桀儔 (Issue #19)
- **蝡 (rontend/src/pages/RichMenu.jsx)**: 靽格迤蝔詨桅閮剝獢拚＊蝷箇憿嚗刻孛澆雿銝詨桐葉瞈曉歇詨柴
- **蝡 (rontend/src/pages/RuleDesigner.jsx)**: 瞈曉歇詨殷蝣箔閬蝺刻摩⊥豢撌脤詨桐箄孛潛格
- **敺蝡 (ackend/endpoints/richmenu.py)**: 靽格迤摰瑟圈閮剖詨格嚗雿輻 ulk_link_all_users 撠渲鈭箄身摰 Bug

## [2026-06-30] 詨桅閮剜閮憿舐內靽桀儔鞈摨怠甇乩耨甇
- **蝡 (`frontend/src/pages/RichMenu.jsx`)**: 靽格迤啣 hidden 蝑亦詨桀嚗剜憭折隢瘙撠游翰湔啁啣虜 LINE API 急芸喲閮剔嚗閮剝詨桅脫閮瘨憭梁憿撠鞈摨 metadata 銝剔 `default` ( `public`) 詨 ID 銋銝雿萇 `defaultMenuIds` 文嚗蝣箔閮剜閮蝛拙憿舐內
- **敺蝡 (`backend/endpoints/richmenu.py`)**: 靽格迤鈭暺銵函閮剔箏典閮剝詨柴嚗 `oa_id` 霈豢芸蝢拙渲摨 (`Global_var`  `rich_menu_metadata`) ⊥甇蝣箸湔圈閮剔 Bug
- **敺蝡 (`backend/endpoints/richmenu.py`)**: 靽格迤鈭典詨桃楊頛舫Ｙ澆銝澆蝑亦箝default嚗芣湔唬 `rich_menu_metadata` 餅湔 `Global_var` 蝝憿曉其隢臬銵券嚗臬蝺刻摩澆粹閮哨甇交湔 `Global_var`  `default_rich_menu` 潦

## [2026-06-30] 詨格孵 ui_uuid 閮剔憿舐內芸
- **敺蝡 (`backend/endpoints/richmenu.py`)**:  `/` (list_rich_menus)  `/all` (list_all_rich_menus) 頝舐曹葉嚗亥岷 `rich_menu_metadata` 鞈銵其誑脣 `ui_uuid`嚗銝血園澆喟 JSON 銝哨隞交舀游蝡臭詨桃湔乩蝙具
- **蝡 (`frontend/src/components/FlexMessageEditor.jsx`)**: 撠 Flex 閮舀詨柴銝撘詨桅賊 value 寧 `ui_uuid`嚗亦 `ui_uuid`  fallback  `richMenuId`嚗啣 `getMenuSelectValue` 頛拙賣賂函摰詨潭芸撠嚗蝣箔 `richMenuId` 澆詨捆
- **蝡 (`frontend/src/pages/RichMenu.jsx`)**: 靽格 `isDefault` 閮剝詨格蝐斤文頛荔寧箸撠詨 ID 臬血冽 LINE 嗅撖衣閮剝詨 ID 銝哨閫瘙箄摨 status  `'published'` 餅 LINE 閮剝詨格⊥憿舐內璅蝡憿
- **甈雿潭湔**嚗撠鞈摨 `rich_menu_metadata` 銝凋誨銵典典閮剝詨桃 `status` 潛 `'public'` 霈渡 `'default'`嚗蝡臭漲甇交湔啣文嚗銝虫撠 `'public'` 詨捆扼

## [2026-06-30] Rich Menu 閮剔憟其犖訾耨甇
- **蝡 (`frontend/src/pages/RichMenu.jsx`)**: 亦撌脩澆詨格銝啣澆 `/customers/count-by-tags`嚗寥＊蝷箇澆/蝯嗡撖怠 metadata  `targetUserCount`  `totalUserCount`嚗蝔輯蝯瘚蝔銝雿萎摮蝮賢末詻
- **敺蝡 (`backend/endpoints/richmenu.py`)**: 脣閮剔箏典閮剜嚗撠銝 OA 嗡 `public` 詨格孵 `published`嚗踹擐箇曉閮剝詨柴
- **敺蝡 (`backend/endpoints/richmenu.py`)**: 閫文典閮剜甇交 metadata  `public` 嚗撌脩澆詨桐蝳甇Ｗ啗蝔選雿閮梢蝯/閮剔湔啣神 metadata

## [2026-06-29] 蝟餌絞UI - 芷斗芸 (蝔梢＊蝷)
- **蝡 (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx)**:
  - 蝔詨殷典芷斤Ⅱ隤芷斗蝷箔葉嚗憿舐內琿蝔晞撌脣芷扎
  - 蝢斤潸荔芷支遙嚗蝷箄舀寧粹＊蝷箄府隞餃蝔晞
  - 萄閬閬嚗芷斤Ⅱ隤蝷箄臭誑撱箇/脣嚗銝憿舐內蝖祉閬 {ID}嚗寧粹＊蝷箔蝙刻閮剖蝔/璅憿/萄

## [2026-06-24] 賊思漱
- ** (frontend/src/pages/AdminPage.jsx)**:
  - 瓦思漱剔隞輻Ｗ輯號皜∠啣

## [2026-06-24] 芸喳思漱
- ** (frontend/src/pages/AdminPage.jsx)**:
  - 曇踵撖抒芸
  - 思漱蝞詨剝思漱

## [2026-06-24] 賣冽乩漸
- **箄 (backend/app.py)**:
  - 賣 `project_stats_processor` 賜亦鈭日啗 `Global_var` 萄 PostgreSQL 擗嚗 `relation already exists` (42P07)  log 瑕單踹祐蝞潘撓鈭仿萄質祈銋拇桀賜 `CREATE TABLE`
- **箄 (backend/endpoints/questionnaire.py, backend/endpoints/liff_questionnaire.py)**:
  - 舀孵貊 `CREATE TABLE IF NOT EXISTS`  `SET LOCAL client_min_messages = warning;`鈭文鞈萄賊∴撕 PostgreSQL  (`relation already exists, skipping`)

## [2026-06-23] 閰冽瞉鈭亦桀舀
- ** (frontend/src/pages/RichMenu.jsx)**:
  - 擏舀 (蟡/)瞏 Modal撖抒捂皜豢銋鞊Ｘ
  - 頛舀質 `publishStrategy` `hidden` (⊥輯)`default` (∪曇澈蝞賊)  `restricted` (啗祆唳芣)
  - 單葡頨急堆撓頛貊賜賣蝞貊頨急啁桀瞉銋桀桀輯嚗豢祆鬲
  - 桀蟡祈都擗喳單葡頨急啁憳
  - 皝桀Ｙ文祆蔬餈典芬芷輯撒豢
  - 瞏 LINE 擗蝯皝銋抵頛航澈啗隞輯圈輻其漲 `default` 豢 API 桀蝞賊桀閰冽

## [2026-06-23] 堆撓∟寥嚗瑁詨桃鈭蟡
- ** (frontend/src/pages/CustomerCenter.jsx)**:
  - 擏舀堆撓∟寥萄質箏餅拙箏餅抵都皜詨喳單葡摨格鳩
  - 豢鳩擗賤喃漲璆祈瑞飭箄皝銋航璆 (Inline Edit)銵祈
  - 豢鳩粹擗嚗瑟寞皝抒詨箸銵皜貉皝抒賊嗆╰頦
  - 桃鈭文豢鳩璆祈/擗摨/Email/瑟蝞貉急閰冽嚗嗆堆撓萄餃桃鈭斗踹單腹嚗

## [2026-06-23] 祇怨瞉踵虜 Bug 賣
- ** (frontend/src/pages/RuleDesigner.jsx)**:
  - 皜貉祆梁怨瞉踹皜賊輻 (隞)
  - 賊閰冽澆祐蝞詨 `<TagInput singleSelect={true}>` 憛閰冽箇ＹＹ桅祇祉銵獢鞈
  - 祈 note 輸- 祆箄祆銵賣嚗嗉豢０蝞芬亦芷瘀瑞捂祇桅鈭衣芷嚗瑞詨
  - 鈭亥貉航岳湧閰冽鞈閰冽箄賂撕 `update("iup|<id>")`  `update("switch_rm|<uuid>")`
  - 賣潸縣祇嚗嗉箏餅 `Line` 蟡寥祇株 URL 餈方蝞豢斗
  - 賣祈箏餅拙嗉單箄祈閰其漱詨格蝞 URL  (怎 React state closure )
  - 賣潸縣航岳渲瞏蝞蝞隤 `ui_uuid`  `rich_menu_id` 鈭行陬箄∟
    - 閰冽 API ∟ `/richmenu/` ( LINE 芷) 賣潸縣 `/richmenu/metadata` ( `ui_uuid` 冽典)箏音怎蝞 `ui_uuid` ⊥桀蟡隞輯岳獢璇 Bug
- ** (frontend/src/pages/Questionnaire.jsx)**:
  -  note 輸- 箄祆葛隤萄怎萄賂撕賣瞏桃璈瘀瑞捂- 桅嚗嗥豢０祆虜
- **箄 (backend/app.py)**:
  - 賣潸縣 `/api/statistics` 鈭亙眺 `get_events_count_by_category_and_tag` 喃漲輯銋踹蝞鞈餈方蝞詨萄質悻
- **箄 (backend/endpoints/questionnaire.py)**:
  - 賣潸縣寧 `update("set_tag|")` 瞉皝斗 `")`  Bug蝞∟伐瑞捂餈斗閰
  - 貊/瞉芰瑞飭芰瑞喲輯賊桃抵賢祐蝞豢賣唳函拇冽蔭
  - 梁鈭文株剜璇 ID瘀瑞甇梁銋拚嚗寥
  - 擏舫∠ `note` 箄祆虜- 鈭血賡賜輯撒- 
  - 賣潸縣剔踵踵Ｚ都踵航輸輯嚗瑞- 桅箄祆腹踹蝞蝑輯撒餌輯孵曄賤芣
  - 賣潸縣賊憛鈭交冽鞈Ｘ `pri_push('tag', '')` 撖 `update("set_tag|")` 鈭行陬瞏
- **箄 (backend/migrate_rule_notes.py)**:
  - 蟡銵交冽摰桃忽貉擗蝯箄祆腹賊- 祆箄祆蝞賡芷剜

## [2026-06-22] 閰冽嚗箄
- ** (frontend/src/pages/RichMenu.jsx)**:
  - 閰冽璆恬撰桀擗璆砍 (輯撒賢)輯撒餃餉澈唳嚗瑕唾砍塚撩桀
  - 閰冽輸閰冽貊寡豢(獢賣閰)頦寥桀豢曇豢輸皜

## [2026-06-18] 祈悻賣
- **箄 (backend/app.py)**:
  - 賣潸縣 /api/statistics 鞈Ｚ鞈Ｚ蝞舀０銵 U 瞍 33  LINE User ID
- ** (RDS & 5014)**:
  - 鈭斗 get_events_count_by_category_and_tag Function閰 LINE User ID 寥∟賡∟祇萄餉﹦

## [2026-06-18] 潛ａ喃蟡芰株摮
- **箄 (backend/endpoints/upload.py)**:
  -  GitHub 潛ａ喃 1MB  5MB
  - ａ 5MB 株蝞 JSON 芰株 413 瞏
- ** (frontend/src/pages/*.jsx)**:
  - 摮萇潛ａ瞏芰 413 (Payload Too Large) 瞏剖舀寡瑞飭潛Ｘ剜寥 5MB
  - 頦寡∟祆輯批賡喃皜航領仿

## [2026-06-18] 閰冽 Fallback 株芾澈
- ** (backend/endpoints/broadcast.py)**:
  - `rich_menu_metadata` 萄賣虜 `permission_tags``fallback_message``alias_id` 輸鈭方皝
- **箄 (backend/endpoints/richmenu.py)**:
  - 閰冽芾皜舫砍喲
- ** (frontend/src/pages/RichMenu.jsx)**:
  - 梁閰冽澆桀皜脰彿桀亥瑞 (Fallback)
  - 券閰其閰冽鈭撖抒貉頦菜璇舀０賂撕
  - 粹蹂漲蝞閰冽游撖抒閰冽鞊Ｘ拇閰冽
  - 瞏 LINE 豢閰冽湧輸 Postback 瞉剜 `menuID`啗方岳獢 `permission_tags` (Python list 桅急) 鈭 `fallback_message`箄∟怨啁潘撓閰
  - 閰冽萄颱漲嚗嗉 Fallback 株祈閉

## [2026-06-18] 祇株舀輯
- ** (frontend/src/pages/RuleDesigner.jsx)**:
  - 擏鈭
  - 方葭皜荔撕蝞單鈭餅鈭斗輯扯祈輯號貉嚗園皝皜⊥葡甇駁踵

## [2026-06-17] ∟祆單賡
- ** (frontend/src/pages/Projects.jsx, Broadcast.jsx, RuleDesigner.jsx, RichMenu.jsx, LiffQuestionnaire.jsx, FlexMessageEditor.jsx)**:
  - 怨∟剖桃Ｘ啣砲芰瑞飭頦寞剜喟ａ GitHub  Repo 鈭銋 GitHub API 剜
  - 踵行憛 (5 MB)嗆 (50 MB) (30 MB)祈郭 (1 MB)閰冽 (1 MB) (1 MB)

## [2026-06-17] 閰冽鈭 Link 
- ** (frontend/src/pages/RichMenu.jsx)**:
  - 瞏貉澈株岳澆鈭 LINE蝞鈭 LINE銋抵 Link鞈鈭斗孵交祈正∪曉瞏貊詨賢亥祆

## [2026-06-17] 閰冽潸寡貉祆唳
- **箄 (backend/endpoints/richmenu.py, backend/endpoints/customers.py)**:
  - 怎捂瞏剛方貉岳獢啁 (`bulk_check_and_update_rich_menu`)
  -  `/api/customers/count-by-tags` 賣螂銵文賢∠閰
  - 粹輯撒駁桀 (/瑟) 瞏閰冽澆豢螂芸瞏餉岳獢
- ** (frontend/src/pages/RichMenu.jsx)**:
  - 擏寧桀嚗
  - 箏餅抵岳澆蟡 (啁)
  - 皜賊渲悻甇寥銵桅祈部格嗥閰
  - 萄塚撓皝唾寞輯

## [2026-06-16] Flex 祆啁皝
- ** (frontend/src/components/FlexMessageEditor.jsx)**:
  - 皜詨賊萇桀鈭亥貉閰冽
  -  payload 怎憛 `sys_bind|{tag}|{journey}|{menu}|{displayText}` 舀寞

## [2026-06-16] 璇Ｚ芰株皝
- **箄 (backend/endpoints/questionnaire.py)**:
  - 梁鈭璇ａ游芰瑞急０輯抒

## [2026-06-12] superpages UI/UX Improvements
- **∟砍 (App.jsx)**:
  - 銵皝抒 OA啣音賢鞈
- **貉 (Projects.jsx)**:
  - 嗆株璆嗆祈郭賜蝞 `preview_image_url` 輯抒嚗 (poster)
  - 文曇璆璇舀剜 duration 瞍脫輯批撖抒賊箄∟芸急祉
- ** (RuleDesigner.jsx)**:
  - 賣潸縣芬亦芷瑟亥算芸賢鞈璆恬撕踹貉瑟賊曇萄
  - 賡芣梁祈瑟亥鈭日株璆蝞銵鈭日 (Loading Spinner) 喳賢賊輯撒餅
- **Ｘ斗螂 (Broadcast.jsx)**:
  - 賣潸縣嗆株祈部嚗瑞飭貉寧蝎對瑞捂桀祈郭 (poster)

## [2026-06-10] superpages dev-and-deploy-docker Update
  - 日株璆砍賢文曇芾貉怎瞍脰⊥圈閰其漱
  - 日株璆砍賢嗆喳桅祈郭鞈
  -  unfollow 賢交輯批 ctive 賢桃臬賢瞍
- **Ｘ斗螂 (Broadcast.jsx)**:
  - 嗆株曉桅祈郭鞈
  - 株思漱鈭斗唳鈭寞喟株
- **株剛 (MessageCenter.jsx)**:
  - 怎蝞璊唳鳩/ UI Bug
  - 賢摮 unfollow 剝賊株芣鈭日∴瑞獢賢甇 follow 箄賊急
- **箄 (backend/app.py)**:
  - 皝 get_users_list  get_project_users API 鈭 is_following ∟祆賢剝拇



### 2026-06-10
- **Feature**: 梁\
ote\ 輯豢箄 \- 鈭血穀
- **Feature**: ∟ (\Questionnaire.jsx\) 璇 \鈭血穀 格璈輯扯航怨
- **Feature**: \RuleDesigner.jsx\ 芬亦芣貉豢０ \鈭血穀 

### 2026-06-10 Customer Center Updates
- **Feature**: 堆撓∟孵單斗 (/)貉輯折航岳獢輯折急斗
- **Feature**: 箄 customers.py  /api/customers/<user_id>/details  DELETE /api/customers/<user_id>/richmenu

- **BugFix**: 賣潸縣堆撓∟孵單貉 SQL 輯璇Ｚ芰 (projects 萄 project_id  project_name)

- **Feature**: 擗蝯剜日擗祈郭格潭孵祆鳩鈭斗銋擗璆菟

## [2026-06-22] Ｘ方岳芾貉
### Added
- 萄賜賢 ui_uuid  group_id 輸鈭方皜貉岳獢Ｘ
- ∟祉輯岳獢暺 UI皜航頛
- 急鞊ａ桀閰冽渲閉
- 怠賊萄賜賣

 # #   [ U n r e l e a s e d ]   -   R i c h   M e n u   U I / U X   U p d a t e s 
 -   * * M o d i f i e d * *    a c k e n d / e n d p o i n t s / c u s t o m e r s . p y :   U p d a t e d   / c o u n t - b y - t a g s   e n d p o i n t   t o   r e t u r n   	 o t a l C o u n t   a l o n g   w i t h   m a t c h e d   u s e r   c o u n t . 
 -   * * M o d i f i e d * *    r o n t e n d / s r c / p a g e s / R i c h M e n u . j s x :   A d d e d   U I   e l e m e n t s   t o   d i s p l a y   t h e   p e r c e n t a g e   o f   t o t a l   f o l l o w e r s   f o r   t a r g e t e d   a n d   d e f a u l t   r i c h   m e n u s .   A d d e d   a   d e d i c a t e d   L i n k M o d a l   c o m p o n e n t   f o r   s e l e c t i n g   t h e   l i n k a g e   s t r a t e g y   f r o m   t h e   L i s t   V i e w .   A d d e d   i n l i n e   t a r g e t   m e n u   p r e v i e w   f u n c t i o n a l i t y   f o r   
 i c h m e n u s w i t c h   a r e a   a c t i o n s . 
 
 
 # #   [ U n r e l e a s e d ]   -   R i c h   M e n u   M i n o r   F i x e s 
 -   * * M o d i f i e d * *    r o n t e n d / s r c / p a g e s / R i c h M e n u . j s x :   A d d e d   d r a f t   d e l e t i o n   b u t t o n   i n s i d e   g r o u p   t a b s ,   i m p l e m e n t e d   c r e a t e _ a n d _ s w i t c h   q u i c k   a c t i o n   i n   a r e a   s w i t c h   d r o p d o w n ,   s t a c k e d   s c h e d u l e   t i m e   i n p u t s   v e r t i c a l l y ,   a n d   f i x e d   t a r g e t   m e n u   i m a g e   p r e v i e w   b y   f e t c h i n g   f r o m   b l o b   c a c h e . 
 
 
- **Bug Fix (2026-06-23)**: 賣剖貉岳湔銋典啗祆唳芣琿 targetTags 蝞敺皜⊥嚗瑟渡砂交輯扯質斗

*   **customers API**: 賣閰 /count-by-tags 舀０剝皜豢踹撖抒祈悻閰冽銵冽鞈 ()輻剔捂鞎蝞

## 2026-06-25
- [蝔  WebSocket  SIGNATURE_KEY 芾賡鈭西岳 Line-Bot-Main 啣餉
## [2026-06-25] - Syslog Integration
### Added
- 游 NAS Syslog嚗賢閮閬敺蝡舀雿銵 (啣詨柴靽格孵獢閮剖臬交蝔蝑)
- 啣 utils/syslogger.py  ReconnectingSSLSysLogHandler嚗撠 Syslog 曄蔭臬瑁蝺嚗蝣箔蝺銝蝛拇 API 銝敶梢踴
- 舀渡啣霈 NAS_SYSLOG_APPNAME  Docker  Heroku 函蔡啣


## [2026-06-25] - Keyword Reply Duplicate Validation
### Added
- 萄閬 (RuleDesigner 蝪⊥璅∪): 脣芸瑼Ｘ交臬西嗡萄璅憿銴嚗仿銴頝喳箸蝷箏遣霅圈踹嚗嫣噶敺啁恣

## [Unreleased] - 2026-06-25
### Added
- 詨桃恣嚗啣唬喋賬
- 詨桃恣嚗撱箇畾萄乩/銝剔頛亙恍脣
- 詨桃恣嚗撠摰蝬摰撠鞊∪憟(閮)蝑伐亙券憟賢憟(ALL_USERS)摰璅蝐斤豢璈嗚
### Fixed
- 詨桃恣嚗靽格迤豢芸遣蝡趺ine銝箇暹蝔閮剖UI頛胯
- 詨桃恣嚗靽桀儔銝嗅亦⊥憿舐內憿嚗寧典典 useEffect 芸瑼Ｘ亙敶勗
- 萄閮臭葉敹嚗瞈暹冽芾身摰 fallback message Ｙ [text] 摮銝莎踹嗅僕曇臭葉敹梢萄蝯梯


## 2026-06-29
- **Feature**: 撖虫詨株芸蝔芷日脣璈塚芷文芸瑼Ｘ仿舐摰銝西歲箸蝷綽敺皜蝛箇賊鞈 (Cascade Clear)
- 貉瑟憛獢啣寞瑞唳蝞豢嗆╰頛豢(: 株狷XX)


## [2026-06-30] 蝟餌絞 UI 撠 BUG 芸
- **蝡 (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx, components/JourneyPreview.jsx, index.css)**:
  - 1. Projects.jsx: 蝔銵函征 LayoutDashboard 蝷箸蝷綽隞亙 alidateProjectForm 啣蝔梢銴⊿頛胯
  - 2. RichMenu.jsx: 冽雿 flex 銵靽格迤 whiteSpace: 'nowrap' 隞亙摮銵嚗isDefault 憓 status === 'public' 舀湛隞交迤蝣箸葡閮剔璅閮
  - 3. RuleDesigner.jsx: 閫貊潮萄蝝 KeywordTagInput 隞塚雿輻券撽嚗靽格迤 .card list item  onMouseLeave 舫脤蝵桅頛胯
  - 4. Broadcast.jsx: 潮撠鞊⊥蝐斤祟豢踵 TagInput 隞塚靽 singleSelect={true}
  - 5. index.css: 隤踵游典 utton 箇璅撘嚗 paddingmin-width  flex 雿撅 gap
  - 6. JourneyPreview.jsx: 摮瘞瘜⊥見撘餈賢 whiteSpace: 'pre-wrap'嚗蝣箔閮舀銵甇蝣粹閬賬

- **蝡 (frontend/src/pages/RichMenu.jsx, Projects.jsx, RuleDesigner.jsx, MessageCenter.jsx)**:
  - RichMenu.jsx: 靽格迤 loading 桃蔗 LoadingSpinner 雿輻冽孵
  - Projects.jsx: 交蝔蝔勗歇摮剁蝎暹憿舐內撠航炊嚗銝憿舐內隢鋆朣敹憛急雿
  - RuleDesigner.jsx: 萄隞 KeywordTagInput 憓瞈曄征潸嚗脣脩征賬
  - MessageCenter.jsx: 刻憭拙恕璅蝐文芷斗 style 銝剖撥嗉 minWidth: 'auto' 踹嗥匱踹典 button 憭批


## [2026-06-30] 蝎暹鈭隞園剛票甇亥芰璈
- **蝡 (components/UserAvatar.jsx, pages/CustomerCenter.jsx, pages/MessageCenter.jsx)**:
  - 啣 UserAvatar.jsx 蝯隞塚隞亙祕曉頛憭望舫甇亙瑟圈剛票憿舐內啗 Icon  Placeholder
  - 踵摰Ｘ嗡葉敹嚗CustomerCenter.jsx嚗銵刻湧甈剛票
  - 踵閮臭葉敹嚗MessageCenter.jsx嚗憭拙銵刻憭 Header 冽園剛票
- **敺蝡 (backend/endpoints/customers.py)**:
  - 啣 
efresh-profile API 蝡舫嚗 LINE Profile 亙啗銝虫蜓湔 DB 銝剔 
ame  pic

  - UserAvatar.jsx: 靽格迤 display: none 撠湧典閬賢其閫貊 img onLoad 鈭隞嗥瞏冽葡 bug嚗嫣誑 opacity  position absolute 頛乓

  - backend/endpoints/customers.py: 芸 refresh-profile 亙撠 LINE API 404 Not Found (撠憟賢) 嚗餈 200 蝛箏潘脤餃蝡 Console 霅血晞

  - backend/endpoints/customers.py: 靽格迤脣 LINE Profile  API 蝡舫頝臬 /v2/bot/profile/{userId}

  - frontend/src/components/UserAvatar.jsx: 啣 loading_refreshed 隞仿脫迫剖頛亙仃⊿芰隤輻刻艘
  - backend/endpoints/customers.py: 芸 refresh_customer_profile 啣虜蝺塚踹 Connection Leak
 
  
 -   2 0 2 6 - 0 7 - 0 1 :   U p d a t e   F l e x M e s s a g e E d i t o r   t o   p r i o r i t i z e   u i _ u u i d   o v e r   r i c h M e n u I d   w h e n   c o n f i g u r i n g   r i c h   m e n u s w i t c h   f o r   f l e x   m e s s a g e   b u t t o n s   t o   e n s u r e   w e b h o o k   r e c e i v e s   t h e   c o r r e c t   U U I D   f o r m a t .  
 -   2 0 2 6 - 0 7 - 0 1   ( H o t f i x ) :   F i x   R e a c t   o p t i o n   r e n d e r i n g   i n   F l e x M e s s a g e E d i t o r   a n d   R u l e D e s i g n e r   b y   s e t t i n g   f a l l b a c k   \  a l u e = { m . u i _ u u i d   | |   ' ' } \   t o   p r e v e n t   t h e   b r o w s e r   f r o m   d e f a u l t i n g   t o   t h e   r i c h   m e n u   n a m e   w h e n   \ u i _ u u i d \   i s   n u l l / u n d e f i n e d .  
 
## [2026-07-06] 詨桅閮剔蝔頛舫瑽
- 靽格迤: \ackend/endpoints/richmenu.py\ 蝘駁支 \save_rich_menu_metadata\  \set_default_rich_menu\ 脣撘瑕嗅嗡閮剝詨桅蝝 \published\ 頛胯
- 啣: \save_rich_menu_metadata\  \set_default_rich_menu\ 銝剖交脣瑼Ｘ伐嗉身摰蝔閮剜交嗡閮剜蝔嚗撠 400 航炊
- 霈: \check_and_apply_scheduled_rich_menus\ 乩芸蝝璈塚閮剝詨格芸湔啁 \published\
- 霈: \rontend/src/pages/RichMenu.jsx\ 斗 UI 銝芯撘菟詨格閰脰◤璅蝷箇箝閮准曉冽瘥撠蝔桀嚗芸圈憿舐內箝蝔敺

## [2026-07-07] Customer Center UI Fixes & LIFF Tag Format
- 蚰 CustomerCenter.jsx kT氶A]珧}CQ~]臟r蚞伬Pe搧eY (繕e) DC
-  CustomerCenter.jsx 上C@ onScroll ⑤A洏峈抮u囧鴝傖自凰牽J挩lW (Infinite Scroll)C
- 蚰 liff_questionnaire.py gJ搢狾 Private_var ⑩氶A~洏 str() 伬PDt庰Lk json.loads T悛R BugFw麍匿一洏 json.dumps(..., ensure_ascii=False) ixsC

## [2026-07-07] Customer Center Background Loading Fix
- 蚰GN CustomerCenter.jsx  Infinite Scroll ^**IJ (Chunked Background Fetch)**C]e揧jMOwgJbO擗弓CApGO搨nUu吨~J]Infinite Scroll^A|伬P|J洏峈怞bjM伂LkQC{b|b鴞綑J犰菾吨J狾⑩鴔農TOjM\iH峇C

 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   -N﹃t_鴮BfhV送X  c r o n _ t a b l e _ c h e c k e r 
 -   送X  b a c k e n d / u t i l s / s c h e d u l e r . p y -N﹃tofczhV0
 -   ,dy  p r o j e c t _ s t a t s _ p r o c e s s o r     r i c h _ m e n u _ s c h e d u l e r _ p r o c e s s o r   _  a p p . p y     s c h e d u l e r . p y 0
 -   送X  c r o n _ t a b l e _ c h e c k e r   氠R[BfT@b	gwQ
kP:OghV|v  c h e c k _ c r o n _ t a b l e   w e b s o c k e t   N譸0
 -   yd  a p p . p y   -N
	gcz/魯!|;Nz_0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   薂ck瓠rTA I m絿命tbU I 
 -   yd0*gOR[b_Mb汦悐嬁0eW[0
 -   \Hrb9e歉  f i x e d   [MO漩嵊澕tPkTBfNg b;NgQ鉀@SJXOPy0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   薂ck  c r o n _ t a b l e _ c h e c k e r   |vOUL
 -   薂ck(WwQ	gYP  O A   qQ(u黲T  s o c k e t _ u r l   :OghVv鰥翼Ng|v  W e b S o c k e t   N譸vOUL9e墣  s e t ( )    }&N\氠Phs芏:OghV闢|v N!k0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   薂ck  G u n i c o r n   Y  W o r k e r   讄L  S c h e d u l e r   OUL
 -   N  U D P   S o c k e t   }[,g0W  P o r t   ( 4 7 2 0 0 )   潩\OLz  ( C r o s s - p r o c e s s   L o c k ) 0
 -   漩嵊!q  G u n i c o r n   _U悐Y\P  W o r k e r T N盬_jhV
N熽	g NP  W o r k e r   g讄LofczMQ癇BfgQ|vQ  t i m e r   Bl0 
 

## [2026-07-15] �湔鰵�餃枂��𩑈
- 撠��蝡航䌊�閧蒈�箸��嗥眏�垍蔭 30 ����寧� 1 憭� (24撠𤩺�)
# #   [ 2 0 2 6 - 0 7 - 1 6 ] 
 # # #   F i x e d 
 -   薂ck𠸍zW囻x𨯿U( R i c h   M e n u ) ��of讄L��/���zl  A P I   'Y��Bl\�:OghV  5 0 3   N�	�vOUL�0
 -   薂ck舸P�W囻x𨯿U0Rg𪊺!q掞ck漩N週�OUL�0
 -   薂ck�u㜁[滍�  ( R u l e   D e s i g n e r )   𢔓芏Bfg��"uu  S e n s o r   �  M e s s a g e   𨶙譸�OUL��鏓d鍈藮�滝R�/�0
 -   薂ck*Rd鉷嬫㜁[滍�Bf豤  t u p l e   p a r s i n g    �b�  5 0 0   /㨩�0 
 -   �Ock�czW�ex��U�V!q  \ u s e r s : { a p p _ n a m e } \   ǌ�eh�\�!q�lck�x���S@b	g(u6bT�U�vOUL�  ( f a l l b a c k   t o   P r i v a t e _ v a r )  
 
 # #   2 0 2 6 - 0 7 - 1 7 :   W�ex��U�cz��/��Ock
 -   �O�_   u l k _ c h e c k _ a n d _ u p d a t e _ r i c h _ m e n u ��S�m�N\�eKb�R�}�[^��czx��U�v�Ow�_j6R��yd�  i f   c u r r   i n   a l l _ e x i s t i n g _ m e n u _ i d s 	���x�O	g�cz�vW�ex��U�� Y!q�h�N��˄!q�czx��U�&NN(W�czP}_g�_ck8^㉁}&N ��V�-�x��U0
 -   (W  s a v e _ r i c h _ m e n u _ m e t a d a t a   -N�ݑ\|v^�2QX[I�?zBf�v  p u b l i s h S t r a t e g y   = =   ' r e s t r i c t e d ' �	g�czx��U	��e�XBf��͑�uW�I���	g]��z\;��d�d\O0 
 

## [2026-07-17] UX / BUG 修正 (Issue #35)
- **RichMenu**: 修正儲存草稿時未能顯示詳細錯誤訊息的問題。
- **RichMenu**: 修正載入發送人數時，會短暫顯示 0 人的狀況，改為顯示「計算中...」提示與動畫。
- **App**: 修正使用者在建立功能項目(如新增選單)過程中，若切換 OA 帳號，不會回到列表頁的問題。
- **Auth/API**: 新增 30 分鐘(後改為1天)閒置登出機制，並在遇到登入失效 (401) 時自動導回登入頁面並顯示相應提示。

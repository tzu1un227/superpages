## [2026-06-30] Rich Menu 預設狀態與套用人數修正
- **前端 (`frontend/src/pages/RichMenu.jsx`)**: 查看已發布圖文選單時不再重新呼叫 `/customers/count-by-tags`，改顯示發布/連結當下寫入 metadata 的 `targetUserCount` 與 `totalUserCount`；草稿與連結流程會一併保存總好友數。
- **後端 (`backend/endpoints/richmenu.py`)**: 儲存或手動設為全域預設時，會將同一 OA 其他 `public` 圖文選單改回 `published`，避免首頁同時出現多個預設選單。
- **後端 (`backend/endpoints/richmenu.py`)**: 解除全域預設時會同步清除 metadata 的 `public` 狀態；已發布選單仍禁止回到草稿，但允許連結/預設狀態更新寫入 metadata。

## [2026-06-29] 系統UI - 刪除提醒優化 (名稱顯示)
- **前端 (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx)**:
  - 旅程與圖文選單：在刪除確認與刪除成功的提示中，顯示具體的「名稱」而非「已刪除」。
  - 群發訊息：刪除任務時，提示訊息改為顯示該任務的「名稱」。
  - 關鍵字回覆與規則：刪除確認、提示訊息以及「建立/儲存」時，不再顯示生硬的「規則 {ID}」，皆改為顯示使用者設定的「名稱/標題/關鍵字」。

## [2026-06-24] 芸銝脫交蝔獢
- **蝡 (frontend/src/pages/AdminPage.jsx)**:
  - 瞏日ˇ銝脫交蝔銝剔鈭甇仿獢嚗雿踹嗆渡箏璆凋摰寞閫

## [2026-06-24] 蝞∠∪唳啣銝脫交蝔
- **蝡 (frontend/src/pages/AdminPage.jsx)**:
  - 撠撣唾蝞∠璅憿湔寧箝蝞∠∪啜
  - 啣銝脫交蝔嚗箸啣董鈭銝脫交郊撽

## [2026-06-24] 靽桀儔鞈摨急亥芷
- **敺蝡 (backend/app.py)**:
  - 靽桀儔鈭 `project_stats_processor` 冽甈⊥炎交閰血遣蝡 `Global_var` 鞈銵剁撠 PostgreSQL 餌Ｙ `relation already exists` (42P07)  log 芷喳憿寧箏瑼Ｘ亥銵冽臬血剁乩摮冽瑁 `CREATE TABLE`
- **敺蝡 (backend/endpoints/questionnaire.py, backend/endpoints/liff_questionnaire.py)**:
  - 蝯曹典瑁 `CREATE TABLE IF NOT EXISTS` 銋銝 `SET LOCAL client_min_messages = warning;`嚗隞交嗅瑞賊鞈銵典遣蝡Ｙ PostgreSQL 芷 (`relation already exists, skipping`)

## [2026-06-23] 詨桃澆蝑亥甈閮剖蝯曹
- **蝡 (frontend/src/pages/RichMenu.jsx)**:
  - 蝘駁支潔撠鞊 (祇/摰)潔 Modal嚗寧箸游澆蝑乓豢憛
  - 蝔輯曉冽脣 `publishStrategy`嚗 `hidden` (蝝銝嗡憿舐內)`default` (蝡唾身箏券閮)  `restricted` (摰蝬摰撠鞊∪憟)
  - 喳渲身摰Ｘ輸瑽箔函憛嚗箸祈身摰甈閮剖澆蝑乓蝔閮剖憛閮剖嚗雿蹂Ｘ湔唬氬
  - 憛閮剖勗祉閬賣蝘餉喳喳渲身摰甈銝嫘
  - 湔啜甈閮剖獢箝隤啣臬潭迨嚗蝪∪雿輻券撽
  - 潔 LINE 嚗蝟餌絞湔乩蝔輯身摰蝑仿脰雿璆哨亦 `default` 芸澆怠蝡 API 閮剖箏典閮剖詨柴

## [2026-06-23] 摰Ｘ嗡葉敹隞Ｗ芸單甇亙祕雿
- **蝡 (frontend/src/pages/CustomerCenter.jsx)**:
  - 蝘駁支摰Ｘ嗡葉敹銵函蝺刻摩嚗撠蝺刻摩賣游喳喳渲底蝝啗閮湧甈銝准
  - 典湧甈蝔晞璈餃靽∠拳亦楊頛臬蝷綽暺舐湔乓扯舐楊頛 (Inline Edit)嚗銝血臬脣瘨
  - 芸湧甈頛荔暺銝剝銝餌恍Ｗ批捆嚗湧甈芸嚗暺撌血游芣湧甈折典銝敶梢踴
  - 撘瑕單甇交塚典湧甈抒楊頛臬蝔/餉店/Email啣/芷斗蝐扎箄芸蝔閫文詨桀嚗恍Ｖ摰Ｘ嗅銵刻單甇交湔堆⊿唳渡Ｕ

## [2026-06-23] 萄閬閫貊澆雿游 Bug 靽桀儔
- **蝡 (frontend/src/pages/RuleDesigner.jsx)**:
  - 游萄閬撱箇閫貊澆雿嚗舀游雿瑁 (隞仿)
  - 芸銝璅勗銝詨格寧箸剝 `<TagInput singleSelect={true}>` 隞塚靘詨敺獢獢璅閮餌閬閬箏擖銝衣雁桅賊嗚
  - 萄閬脣芸 note 甈雿銝- 萄閬敺蝬湛銝血函恍Ｖ芸梯嚗蝣箔蝪⊥璅∪銝芷＊蝷箸萄閬閮餉瘜嚗撌亦璅∪靘園＊蝷箏券具
  - 啣亥芸蝔蝯詨柴銝詨桅賊嚗詨敺芸Ｙ撠 `update("iup|<id>")`  `update("switch_rm|<uuid>")`
  - 靽格迤萄閬隞Ｖ葉嚗蝺刻摩 `Line` 撅祆抒暹閬閮舀嚗銝喳 URL 芣迤蝣箸湔啣啣撅斤憿
  - 靽桀儔萄閬蝺刻摩其葉嚗銝喳敺蝬脣頛詨交芸單湔啁箸 URL 憿 (閫瘙 React state closure 憿)
  - 靽格迤蝯詨柴賊潘蝣箔甇蝣箔誨 `ui_uuid`  `rich_menu_id` 隞亦泵敺蝡舫
    - 撠脣詨桃 API 蝡舫 `/richmenu/` ( LINE 憪鞈) 靽格迤 `/richmenu/metadata` (喳 `ui_uuid` 鞈摨怨帑鞈)嚗敺孵閫瘙箏曆 `ui_uuid` 鋡恍閮剖神仿詨桀蝔梁 Bug
- **蝡 (frontend/src/pages/Questionnaire.jsx)**:
  - 瑞恣脣芸 note 甈雿銝- 瑞恣敺蝬港誑抵儘霅嚗銝虫瑕銵券Ｙ曉冽湔潮瞈橘芷＊蝷箸- 瑞恣閮餉瘜嚗恍Ｖ璅芸梯甇文蝬游銝脯
- **敺蝡 (backend/app.py)**:
  - 靽格迤 `/api/statistics` 銝剜亥岷 `get_events_count_by_category_and_tag` 喳亦憿蝔勗之撠撖怠憿嚗蝣箔賣迤蝣箸啣銵冽豢
- **敺蝡 (backend/endpoints/questionnaire.py)**:
  - 靽格迤霈暹瑟嚗閫 `update("set_tag|璅蝐")` 澆撠湔蝐斤撠曉 `")`  Bug嚗蝣箔蝡舀蝐日＊蝷箸迤撣詻
  - 芸瑞恣摮/澆園航炊蝷綽撠航炊蝷箝唳雿萄典銝摮瘞瘜∩葉嚗曉冽寧箸拙函撠閰望部瘜∩摨潮
  - 撱箇瑟交嚗喟閮臭怠瑕蝔梯 ID嚗芷＊蝷箝瑕歇撱箇嚗隞乩隞Ｙ陛瞏
  - 蝘駁支餃遣蝡瑟撘瑕嗅 `note` 敺蝬游銝- 撌亦冽頛荔曉函絞銝雿輻具- 瑞恣憿
  - 靽格迤鈭琿憿抒獢賣嚗憿扯舐璅憿銝雿菟＊蝷箝- 瑞恣蝑閮餉敺蝬渡憿嚗蝣箔曄策雿輻刻璅憿蝔曹嗾瘛函∪摮
  - 靽格迤瑞恣銝剔芸銝璅璈塚撖怠亥摨怎賢澆敺 `pri_push('tag', '璅蝐')` 寧 `update("set_tag|璅蝐")` 隞亦泵啗潦
- **敺蝡 (backend/migrate_rule_notes.py)**:
  - 啣神銝血瑁銝甈⊥抒鞈摨恍瑞宏單穿撠銝芸葆蝟餌絞敺蝬渡瘜芸鋆銝- 萄閬敺蝬湛蝣箔鞈銝函陛璅∪銝剜憭晞

## [2026-06-22] 詨桐Ｚ賊芸
- **蝡 (frontend/src/pages/RichMenu.jsx)**:
  - 詨桃楊頛舫Ｖ葉嚗撠憛閮剖憛蝘餉喟楊頛臬喳 (雿輻冽帖)嚗霈雿輻刻刻身摰憛銝脣恍Ｗ喳臬啣敶Ｚ閮剖甈雿
  - 詨桃憛雿銝撘詨桐葉嚗芸瞈暹芸楛(桀甇函楊頛舐詨)嚗踹閮剖芸楛頝唾芸楛⊿餈游

## [2026-06-18] 蝬豢靽桀儔
- **敺蝡 (backend/app.py)**:
  - 靽格迤 /api/statistics 憟賢貉憟賢貉蝞嚗蝣箔蝯梯蝚血 U 凋瑕漲 33  LINE User ID
- **鞈摨 (RDS & 5014)**:
  - 甇交湔 get_events_count_by_category_and_tag Function嚗啣詨 LINE User ID 瞈暹隞嗡誑靽霅蝡臬銵刻蝎曄Ⅱ∟炊

## [2026-06-18] 瑼獢銝喳之撠嗆曉祝航炊閮舀孵
- **敺蝡 (backend/endpoints/upload.py)**:
  - 撠 GitHub 瑼獢銝喳之撠嗥 1MB 擃 5MB
  - 嗆獢頞 5MB 單蝣箇 JSON 航炊閮臬 413 蝣潦
- **蝡 (frontend/src/pages/*.jsx)**:
  - 孵瑼獢銝喟潛航炊頛荔嗆脣 413 (Payload Too Large) 蝣潭嚗蝯曹蝷綽瑼獢憭改銝航 5MB
  - 踹蝡臬憿舐內函銝喳仃撠港蝙刻⊥閫

## [2026-06-18] 詨桀甈 Fallback 閮航身摰
- **鞈摨 (backend/endpoints/broadcast.py)**:
  - `rich_menu_metadata` 鞈銵冽游 `permission_tags``fallback_message``alias_id` 甈雿隞交舀湔抒恣璈嗚
- **敺蝡 (backend/endpoints/richmenu.py)**:
  - 脣霈詨株舀港餈唬唳雿
- **蝡 (frontend/src/pages/RichMenu.jsx)**:
  - 撱箇詨格啣甈閮剖憛嚗舀渲詻甈璅蝐扎閮剖⊥蝷箄 (Fallback)
  - 瘨頛詨乓詨桀亙嚗寧箏典脣蝔踵潔梁頂蝯梯芸Ｙ
  - 憛暺雿亦箝詨柴嚗寧箔詨桅豢撌脩潔詨柴
  - 潔 LINE 嚗芸撠詨柴雿頧 Postback 澆嚗憭曉葆閮 `menuID`閰脤詨桃 `permission_tags` (Python list 摮銝脫澆) 隞亙 `fallback_message`嚗靘敺蝡舫脰甈瑼Ｘ詻
  - 詨桀銵刻亦恍Ｖ葉啣甈璅蝐方 Fallback 閮舐閬賬

## [2026-06-18] 萄閬閮舐雯憿舐內
- **蝡 (frontend/src/pages/RuleDesigner.jsx)**:
  - 蝘駁文亦
  - 隤踵港Ｙ箝銝喳湔亙刻撓交憿舐內蝬脣嚗雿踹嗉芸蝔蝔隞Ｖ銝湛靘渡渲死雿擃撽

## [2026-06-17] 蝡臬擃銝喳捆嗉撽霅
- **蝡 (frontend/src/pages/Projects.jsx, Broadcast.jsx, RuleDesigner.jsx, RichMenu.jsx, LiffQuestionnaire.jsx, FlexMessageEditor.jsx)**:
  - 撖虫蝡臭單獢摰寥嗉航炊蝷綽踹憭扳獢銝唾 GitHub  Repo 亙之 GitHub API 嗉憭望
  - 憿慦擃塚 (5 MB)敶梁 (50 MB)單 (30 MB)閬賢 (1 MB)詨桀 (1 MB)瑁臬 (1 MB)

## [2026-06-17] 詨桀甇亥 Link 
- **蝡 (frontend/src/pages/RichMenu.jsx)**:
  - 潸身閮詨格嚗撠甇亥 LINE箝甇亥 LINE甇乩蒂 Link拙賊嚗隞交批嗥潔臬西蝡唾孛潸璅蝐斗券冽嗥蝬摰

## [2026-06-17] 詨格蝐方芸蝬摰湔
- **敺蝡 (backend/endpoints/richmenu.py, backend/endpoints/customers.py)**:
  - 撖虫箸潭蝐斤芸詨桃摰璈 (`bulk_check_and_update_rich_menu`)
  - 啣 `/api/customers/count-by-tags` 冽潸蝞蝚血璅蝐斤冽嗡犖詻
  - 敺雿輻刻閮剖霈 (啣/芷斗蝐) 潔詨格嚗芸潸航孛潔蝙刻詨桀
- **蝡 (frontend/src/pages/RichMenu.jsx)**:
  - 蝘駁方甈抒恣閮剖隞Ｕ
  - 蝺刻摩詨格啣祇摰 (摰璅蝐)曄
  - 舀游銴豢蝐歹銝血單閬賡閮憟其犖詻
  - 銵其Ｘ湔唳蝐方潔憿舐內

## [2026-06-16] Flex 蝬摰璈嗆湔
- **蝡 (frontend/src/components/FlexMessageEditor.jsx)**:
  - 舀游典銵箔葉閮剖亥芸蝔詨柴
  - 瑽 payload 閫璈塚∠ `sys_bind|{tag}|{journey}|{menu}|{displayText}` 蝯曹澆

## [2026-06-16] 瑕蝔梢航炊閮舀湔
- **敺蝡 (backend/endpoints/questionnaire.py)**:
  - 撱箇瑟亙蝔梢銴嚗航炊蝷箄舫梯憿舐內瑕蝔勗銝脯

## [2026-06-12] superpages UI/UX Improvements
- **蝡臬典 (App.jsx)**:
  - 撌血湧甈 OA嚗摰孵董嚗憛啣函嗅撅賬
- **芸蝔 (Projects.jsx)**:
  - 敶梁閮舐楊頛舀嚗敶梁閬賢曉冽甇蝣箏 `preview_image_url` 憿舐內箏Ｗ (poster)
  - 脤唾舐楊頛舀嚗梯憭擗 duration 瑕漲憿舐內嚗寧箇芸霈敺蝡航嚗銝撟脫曇閬箝
- **萄閬 (RuleDesigner.jsx)**:
  - 靽格迤蝪⊥璅∪銝芷日萄敺∪函征賜楊頛舫Ｙ憿嚗曉典芷文芸頝唾萄銵具
  - 函陛璅∪撱箇萄閬芷日萄隞亙脤閮舐楊頛舐蝣箄銝血脣銝嚗啣頛交頧 (Loading Spinner) 蝳函嚗芸雿輻刻擃撽
- **蝢斤潸 (Broadcast.jsx)**:
  - 靽格迤敶梁閮舐閬賡＊蝷綽曉典蔣芣剜暹甇蝣粹＊蝷箸閮剖閬賢 (poster)

## [2026-06-10] superpages dev-and-deploy-docker Update
  - 脤閮舐楊頛臬冽啣隤唾航芸菜葫瑕漲踝銝阡摰頛詨交
  - 脤閮舐楊頛臬冽啣敶梁銝喳單閬賢賬
  - 啣撠 unfollow 冽嗥憿舐內嚗撠 ctive 銝撌脣冽嗆閮箝撌脖葉瑯嚗靽嗅脣漲
- **蝢斤潸 (Broadcast.jsx)**:
  - 敶梁閮舀啣銝唾單閬賢賬
  - 閮舫交嚗交撌脰撓亙批捆頝喳箄郎閮胯
- **閮臭葉敹 (MessageCenter.jsx)**:
  - 閫瘙箏椰湧甈皛曉啣冽/ UI Bug
  - 冽嗉孛 unfollow 鈭隞嗆芸閮航撓交銝阡＊蝷箝桀冽嗅歇撠嚗 follow 敺芸閫撠
- **敺蝡 (backend/app.py)**:
  - 湔 get_users_list  get_project_users API 隞亙 is_following 嚗靘蝡臬斗瑞冽嗉蕭頩斗瘜



### 2026-06-10
- **Feature**: 瑞恣撱箇瑟嚗\
ote\ 甈雿芸敺蝬 \- 撌亦冽\
- **Feature**: 瑞恣蝡舐恍 (\Questionnaire.jsx\) 梯 \撌亦冽\ 摮撠橘銝憿舐內蝯虫蝙刻
- **Feature**: \RuleDesigner.jsx\ 蝪⊥璅∪拍券萄瞈暸梯撣嗆 \撌亦冽\ 瑯

### 2026-06-10 Customer Center Updates
- **Feature**: 摰Ｘ嗡葉敹喳湔啣璅蝐斤恣 (啣/芷)芸蝔憿舐內銝剜瑯詨桃憿舐內閫斤摰
- **Feature**: 敺蝡 customers.py 啣 /api/customers/<user_id>/details  DELETE /api/customers/<user_id>/richmenu

- **BugFix**: 靽格迤摰Ｘ嗡葉敹喳湔霈芸蝔 SQL 甈雿蝔梢航炊 (projects 銵函 project_id  project_name)

- **Feature**: 蝟餌絞憭撅斤銝餃閬賢啣蝮格暹嚗臬湧甈嗅隞交曉之銝餃極雿

## [2026-06-22] 蝢斤詨株芸蝯
### Added
- 鞈銵函瑽啣 ui_uuid  group_id 甈雿隞交舀游詨桅蝢斤
- 蝡臬祕雿詨桃黎蝯 UI嚗舀港誑蝐文銝蝔輯
- 撖虫潔豢閮剖詨柴賬
- 撖虫典鞈銵函瑽湔啜

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
- **Bug Fix (2026-06-23)**: 靽桀儔鈭典詨柴澆蝑乓銝哨嗅啜摰蝬摰撠鞊∪憟具銝 targetTags 箇征撠渡恍Ｗ援瞏唬⊥憿舐內舐冽蝐斤憿

*   **customers API**: 靽桀儔詨 /count-by-tags 蝯梯頛臭銝游憿嚗寧箄蝬豢詨撖行暑頨憟賢 (芸)雿箇蜇鈭箸貉蝞箸

## 2026-06-25
- [稽 啣 WebSocket 蝺 SIGNATURE_KEY 蝪賜撽霅嚗隞亦詨捆 Line-Bot-Main 啁摰刻蝭
## [2026-06-25] - Syslog Integration
### Added
- 整合 NAS Syslog，能夠記錄重要的後端操作行為 (新增圖文選單、修改專案設定、匯入排程等)。
- 新增 utils/syslogger.py 與 ReconnectingSSLSysLogHandler，將 Syslog 拋送放置背景執行緒，確保連線不穩時 API 不受影響。
- 支援環境變數 NAS_SYSLOG_APPNAME 區分 Docker 與 Heroku 部署環境。


## [2026-06-25] - Keyword Reply Duplicate Validation
### Added
- 關鍵字回覆 (RuleDesigner 簡易模式): 儲存時自動檢查是否與其他關鍵字標題重複，若重複則跳出提示建議避免，方便後台管理。

## [Unreleased] - 2026-06-25
### Added
- 圖文選單管理：新增「重新上傳」圖文功能。
- 圖文選單管理：建立階段加入上傳/處理中的載入動畫防呆。
- 圖文選單管理：針對「指定綁定對象後套用(非預設)」策略，加入全體好友套用(ALL_USERS)或指定標籤的選擇機制。
### Fixed
- 圖文選單管理：修正選擇「只建立至line」時不應出現排程設定的UI邏輯。
- 圖文選單管理：修復圖文上架後查看無法顯示原先圖片的問題，改用全域 useEffect 自動檢查及抓取影像。
- 關鍵字與訊息中心：過濾掉在未設定 fallback message 時產生的 [text] 字串，避免其干擾訊息中心與熱門關鍵字統計。


## 2026-06-29
- **Feature**: 實作圖文選單與自動旅程的刪除防呆機制，刪除前自動檢查關聯綁定並跳出提示，同意後再連動清空相關資料 (Cascade Clear)。
- 芸芷斗璈塚園桃摰啣嗅批捆嚗蝷箏閰望撠箸敶梢輸桃蝔(憒: 璅皞閮胯XXX)


## [2026-06-30] 系統 UI 與小 BUG 雜項優化
- **前端 (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx, components/JourneyPreview.jsx, index.css)**:
  - 1. Projects.jsx: 旅程列表空狀態加入 LayoutDashboard 圖示提示，以及 alidateProjectForm 新增名稱重複的校驗邏輯。
  - 2. RichMenu.jsx: 頂部操作按鈕 flex 換行修正與 whiteSpace: 'nowrap' 以免文字折行；isDefault 增加 status === 'public' 支援，以正確渲染預設狀態標記。
  - 3. RuleDesigner.jsx: 觸發關鍵字升級為 KeywordTagInput 元件，提升使用體驗；修正 .card list item 的 onMouseLeave 背景顏色重置邏輯。
  - 4. Broadcast.jsx: 發送對象標籤篩選替換為 TagInput 元件，保持 singleSelect={true}。
  - 5. index.css: 調整全域 utton 基礎樣式，包括 padding、min-width 及 flex 佈局與 gap。
  - 6. JourneyPreview.jsx: 文字氣泡樣式追加 whiteSpace: 'pre-wrap'，確保訊息換行正確預覽。

- **前端 (frontend/src/pages/RichMenu.jsx, Projects.jsx, RuleDesigner.jsx, MessageCenter.jsx)**:
  - RichMenu.jsx: 修正 loading 遮罩與 LoadingSpinner 使用方式。
  - Projects.jsx: 若旅程名稱已存在，精準顯示對應錯誤原因，不再顯示「請先補齊必填欄位」。
  - RuleDesigner.jsx: 關鍵字元件 KeywordTagInput 增加過濾空值處理，防呆防空白。
  - MessageCenter.jsx: 在聊天室標籤刪除按鈕 style 中強制覆蓋 minWidth: 'auto' 避免其繼承全域 button 大小。


## [2026-06-30] 精準事件驅動頭貼同步與自癒機制
- **前端 (components/UserAvatar.jsx, pages/CustomerCenter.jsx, pages/MessageCenter.jsx)**:
  - 新增 UserAvatar.jsx 組件，以實現加載失敗背景非同步刷新頭貼與顯示灰色 Icon 的 Placeholder。
  - 替換客戶中心（CustomerCenter.jsx）列表與側邊欄頭貼。
  - 替換訊息中心（MessageCenter.jsx）聊天列表與聊天 Header 用戶頭貼。
- **後端 (backend/endpoints/customers.py)**:
  - 新增 
efresh-profile API 端點，透過 LINE Profile 接口拉取最新資料並主動更新 DB 中的 
ame 與 pic。

  - UserAvatar.jsx: 修正 display: none 導致部分瀏覽器不觸發 img onLoad 事件的潛在渲染 bug，改以 opacity 與 position absolute 處理載入。

  - backend/endpoints/customers.py: 優化 refresh-profile 接口對 LINE API 404 Not Found (封鎖或非好友) 的處理，返回 200 配合空值，防阻前端 Console 警報。

  - backend/endpoints/customers.py: 修正獲取 LINE Profile 的 API 端點路徑為 /v2/bot/profile/{userId}。

  - frontend/src/components/UserAvatar.jsx: 新增 loading_refreshed 狀態以防止頭像載入失敗時的無限自癒調用迴圈。
  - backend/endpoints/customers.py: 優化 refresh_customer_profile 的異常處理與連線回收，避免 Connection Leak。

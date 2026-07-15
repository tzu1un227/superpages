## [2026-07-15] Âù­yªk«h¾÷¨î Bug ­×´_ (Issue #31)
- **­×¥¿ (backend/endpoints/rule_designer.py)**: ­×¥¿«Ø¥ß¡B§R°£ªk«h®É¡AµLªk¥¿½T¦P¨B Sensor ªk«hªº°İÃD (­ì¥»»~¥Î category »P msg_in Äæ¦ì¡A²{¤w­×¥¿¬° type »P content Äæ¦ì)¡C
- **­×¥¿ (frontend/src/components/FlexMessageEditor.jsx)**: ­×¥¿·í«ö¶s¥¼¸j©w¼ĞÅÒ®É²£¥Íªº sys_bind ®æ¦¡·|¾É­P Webhook ¸ÑªRµo¥Í SyntaxError ªº°İÃD¡A±NªÅªº¼ĞÅÒ¦r¦ê§ï¬° []¡C

## [2026-07-15] ¹Ï¤å°T®§¹wÄı»P«ö¶sÄ²µo¾÷¨î­×¥¿ (Issue #31)
- **­×¥¿ (frontend/src/components/FlexMessageEditor.jsx)**: ­×¥¿¹Ï¤å°T®§¼ĞÃDµLªk´«¦æ (wrap: true) »P¼ĞÃD/»¡©ú¤å¦r¶¡¶Z¹L¤pªº±Æª©°İÃD¡C
- **­×§ï (frontend/src/components/FlexMessageEditor.jsx)**: ²Î¤@©Ò¦³°T®§«ö¶sªº Postback ®æ¦¡¬° sys_bind|...|¹ê»Ú¤å¦r¡AÅı«áºİ¯à¦³¤@­Pªº¸ÑªR®æ¦¡¡C
- **­×§ï (backend/endpoints/rule_designer.py)**: ¦b«Ø¥ß¡B§ó·s¡B§R°£ÃöÁä¦r¦^ÂĞ (Message) ªk«h®É¡A¦P¨B³B²z¹ïÀ³ªº Sensor ªk«h (Âù­yªk«h¾÷¨î)¡A¥H¸Ñ¨M¹Ï¤å°T®§ÁôÂÃ«ö¶sµLªkÄ²µoÃöÁä¦rªº°İÃD¡C

## [2026-07-07] ¸å®é¯èª¤ä¿®å¾© (Issue #19) - Part 3
- **å¾ç« (ackend/endpoints/richmenu.py)**: ä¿®æ­£ /richmenu  /richmenu/all API ªå end_time é¡ï¼å°´åç« FlexMessageEditor (å¦ªåç¨è¨­å) ¨åè©¦éæ¿¾å·²çµ¸å®æç¼ºåè³å¤±æ¾å API å·²ææ­¥å end_time

## [2026-07-07] ¸å®é¯èª¤ä¿®å¾© (Issue #19) - Part 2
- **ç« (rontend/src/components/FlexMessageEditor.jsx)**:  Flex è¨¯ç·¨è¼¯å¨çé»é»ä¸¸å®ä¸­ï¼ä¸æ¿¾å·²¸å®çè¼¯ã
- **å¾ç« (ackend/endpoints/richmenu.py)**: ä¿®æ­£ ulk_check_and_update_rich_menu ¨åæª¢æ¥æï¼å¼·å¶è§£¤ã³é¸å®ã¨æ¶çå® Bugï¼±æå°¨æ¶ç¶å 
ich_menu ä¾è·³éè¨­å¨æ¶ã

## [2026-07-07] ¸å®é¯èª¤ä¿®å¾© (Issue #19)
- **ç« (rontend/src/pages/RichMenu.jsx)**: ä¿®æ­£ç¨¸å®éè¨­éæ¡©é¡¯ç¤ºçé¡ï¼¨è§¸¼åä½ä¸¸å®ä¸­æ¿¾å·²¸å®ã
- **ç« (rontend/src/pages/RuleDesigner.jsx)**: æ¿¾å·²¸å®ïç¢ºäè¦ç·¨è¼¯¡æ¸æå·²é¸å®äºè§¸¼ç®æ
- **å¾ç« (ackend/endpoints/richmenu.py)**: ä¿®æ­£å®·æ°éè¨­å¸å®æï¼ä½¿ç ulk_link_all_users å°´èäººè¨­å® Bug

## [2026-06-30] ¸å®éè¨­æè¨é¡¯ç¤ºä¿®å¾©è³åº«åæ­¥ä¿®æ­
- **ç« (`frontend/src/pages/RichMenu.jsx`)**: ä¿®æ­£°å hidden ç­¥ç¸å®åï¼­æå¤§éè«æ±å°´å¿«´æ°ç°å¸¸ LINE API «æªå³éè¨­çï¼è¨­é¸å®é²æè¨æ¶å¤±çé¡å°è³åº metadata ä¸­ç `default` ( `public`) ¸å ID ä¹ä¸ä½µç `defaultMenuIds` ¤åï¼ç¢ºäè¨­æè¨ç©©åé¡¯ç¤º
- **å¾ç« (`backend/endpoints/richmenu.py`)**: ä¿®æ­£äºé»è¡¨çè¨­çºå¨åè¨­é¸å®ãï¼ `oa_id` è®¸æªåç¾©å´èåº (`Global_var`  `rich_menu_metadata`) ¡ææ­ç¢ºæ´æ°éè¨­ç Bug
- **å¾ç« (`backend/endpoints/richmenu.py`)**: ä¿®æ­£äº¨å¸å®ç·¨è¼¯é¢ç¼åä¸¼åç­¥çºãdefaultï¼ªæ´æ°ä `rich_menu_metadata` »æ´æ `Global_var` ç´é¡¾å¨äè«¯åè¡¨éï¼¯åç·¨è¼¯¼åºéè¨­ïæ­¥æ´æ `Global_var`  `default_rich_menu` ¼ã

## [2026-06-30] ¸å®æ¹å ui_uuid è¨­çé¡¯ç¤ºªå
- **å¾ç« (`backend/endpoints/richmenu.py`)**:  `/` (list_rich_menus)  `/all` (list_all_rich_menus) è·¯ç±ä¸­ï¼¥è©¢ `rich_menu_metadata` è³è¡¨ä»¥²å `ui_uuid`ï¼ä¸¦å¶é¼å³ç JSON ä¸­ïä»¥æ¯æ´åç«¯ä¸å®ç´æ¥ä½¿¨ã
- **ç« (`frontend/src/components/FlexMessageEditor.jsx`)**: å° Flex è¨¯æ¸å®ãä¸å¼¸å®é¸é value ¹ç `ui_uuid`ï¼¥ç `ui_uuid`  fallback  `richMenuId`ï¼°å `getMenuSelectValue` è¼©å½æ¸ï¨çå®¸å¼æªåå°ï¼ç¢ºä `richMenuId` ¼å¸å®¹
- **ç« (`frontend/src/pages/RichMenu.jsx`)**: ä¿®æ `isDefault` è¨­é¸å®æç±¤ç¤åè¼¯ï¹çºæå°¸å ID ¯å¦å¨æ LINE ¶åå¯¦çè¨­é¸å ID ä¸­ïè§æ±ºèåº status  `'published'` »æ LINE è¨­é¸å®æ¡æé¡¯ç¤ºæ¨ç«é¡
- **æ¬ä½¼æ´æ**ï¼å°è³åº `rich_menu_metadata` ä¸­ä»£è¡¨å¨åè¨­é¸å®ç `status` ¼ç `'public'` è®´ç `'default'`ï¼ç«¯äº¦æ­¥æ´æ°å¤åï¼ä¸¦äå° `'public'` ¸å®¹§ã

## [2026-06-30] Rich Menu è¨­çå¥¨äºº¸ä¿®æ­
- **ç« (`frontend/src/pages/RichMenu.jsx`)**: ¥çå·²ç¼å¸å®æä¸°å¼å `/customers/count-by-tags`ï¼¹é¡¯ç¤ºç¼å/çµ¶äå¯«å metadata  `targetUserCount`  `totalUserCount`ï¼ç¨¿èçµæµç¨ä¸ä½µäå­ç¸½å¥½¸ã
- **å¾ç« (`backend/endpoints/richmenu.py`)**: ²åè¨­çºå¨åè¨­æï¼å°ä¸ OA ¶ä `public` ¸å®æ¹å `published`ï¼¿åé¦ºç¾åè¨­é¸å®ã
- **å¾ç« (`backend/endpoints/richmenu.py`)**: è§¤å¨åè¨­ææ­¥æ metadata  `public` ï¼å·²ç¼å¸å®äç¦æ­¢å°èç¨¿ïä½è¨±éçµ/è¨­ç´æ°å¯« metadata

## [2026-06-29] ç³»çµ±UI - ªé¤æªå (ç¨±é¡¯ç¤)
- **ç« (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx)**:
  - ç¨¸å®ï¨åªé¤ç¢ºèªªé¤æç¤ºä¸­ï¼é¡¯ç¤º·éç¨±ãå·²åªé¤ã
  - ç¾¤ç¼è¯ïªé¤ä»»ï¼ç¤ºè¯æ¹çºé¡¯ç¤ºè©²ä»»åç¨±ã
  - µåè¦è¦ï¼ªé¤ç¢ºèªç¤ºè¯ä»¥å»ºç/²åï¼ä¸é¡¯ç¤ºç¡¬çè¦ {ID}ï¼¹çºé¡¯ç¤ºä½¿¨èè¨­åç¨/æ¨é¡/µå

## [2026-06-24] ¸é«äº¤
- ** (frontend/src/pages/AdminPage.jsx)**:
  - ¥Ë«äº¤­çä»¿ç¢å¿è¸¹æ¸¡ç°å

## [2026-06-24] ªå³å«äº¤
- ** (frontend/src/pages/AdminPage.jsx)**:
  - ¾è¿æå¯§çªå
  - «äº¤ç®¸å­é«äº¤

## [2026-06-24] ½æ¨æ¥äº¥
- **ºè (backend/app.py)**:
  - ½æ `project_stats_processor` ½ç¥çäº¤é°è `Global_var` µå PostgreSQL é¤ï¼ `relation already exists` (42P07)  log ·å³æ¿å¯§ç®¼ï¼¸äº¥éµå½è¬èä¹©æ®å½ç `CREATE TABLE`
- **ºè (backend/endpoints/questionnaire.py, backend/endpoints/liff_questionnaire.py)**:
  - ¯æ¹å¸ç `CREATE TABLE IF NOT EXISTS`  `SET LOCAL client_min_messages = warning;`äº¤åè³µå¸é¡ï¼¹ PostgreSQL  (`relation already exists, skipping`)

## [2026-06-23] è©¨ææ¾äº¥ç®å¯æ
- ** (frontend/src/pages/RichMenu.jsx)**:
  - é§¯æ (ç¥/)æ½ Modalå¯§ç®¸æ¸¸æä¹è±¢æ
  - è¼¯æ½è `publishStrategy` `hidden` (¡æ¿è)`default` (¡å¾èº«ç®¸é)  `restricted` (°è¬æ°æªæ)
  - ³æ¸²èº«æ°ï¼¸è¼¸ç½ç½æç®¸çèº«æ°ç®åæ¾ä¹®å®å¿èï¼¸æ¬æ°¬
  - ®åç¥¬è³£é¤³å³æ¸²èº«æ°çå«
  - æ¹®å¢ç¤å¬æ½­è¿¨åªâªé¿è¼»¸æ
  - æ½ LINE é¤çµæ¹ä¹©èè¼¯èº«°èä»¿è°é¿ç¨äº¦ `default` ¸æ API ®åç®¸é®åè©¨æ

## [2026-06-23] °ï¼¸¡è¹éï¼·è¸å®çäºç¥
- ** (frontend/src/pages/CustomerCenter.jsx)**:
  - é§¯æ°ï¼¸¡è¹éµå½èºå»æ©åºå»æ©è³£æ¸¸å³å³æ¸²åº®æ¹§
  - ¸æ¹§é¤½â³äº¦æ¥¬è·ç¶½ºèæ¹ä¹¯èæ¥ (Inline Edit)è¡¬è
  - ¸æ¹§ºéé¤ï¼·æ¹ææ¹§ç¸åºæè¡æ¸¸èæ¹§ç¸é¶æ¢¢è¸
  - ®çäº¤å¸æ¹§æ¥¬è/é¤åº/Email/·æç®¸è«æè©¨æï¼¶æ°ï¼¸µå»å®çäº¤æ¿å³æ¸¡ï¼

## [2026-06-23] ¬é«èæ¾¿æ¸¸ Bug ½æ
- ** (frontend/src/pages/RuleDesigner.jsx)**:
  - æ¸¸è¬æ±ç«èæ¾¿åæ¸¸é¿ç (ä»)
  - ¸éè©¨æ¼å¯§ç®¸å `<TagInput singleSelect={true}>` å¡è©¨æºç¢ç¢ç®é¬é¬çè¡æ¡è³
  - ¬è note ¿é- ¬æºè¬æè¡½æï¼¶è¸æ¢¯ç®ªâ¥çªé·ï·ç®¸¬é®éäº¦çªéï¼·ç¸å
  - äº¥è¸è¯è©¨´éè©¨æè³è©¨æºè¸ï¼¹ `update("iup|<id>")`  `update("switch_rm|<uuid>")`
  - ½æ¼è¿¤¬éï¼¶èºå»æ `Line` ç¥¹é¬é®è URL è¿¤èç®¸æ¤æ
  - ½æ¬èºå»æ©å¶è³æºè¬èè©¨äº¤¸å®æç® URL  («ç React state closure )
  - ½æ¼è¿¤¯è©¨´èæ½ç®ç®èª `ui_uuid`  `rich_menu_id` äº¦æ³µºè¡è
    - è©¨æ API ¡è `/richmenu/` ( LINE ªé) ½æ¼è¿¤ `/richmenu/metadata` ( `ui_uuid` ¨æ¨å)ºå­µ«çç® `ui_uuid` ¡æ®åç¥ä»¿è©¨æ¡æ¢ Bug
- ** (frontend/src/pages/Questionnaire.jsx)**:
  -  note ¿é- ºè¬æ¸¯èªµå«çµå¸ï¼¹½ææ½®çæ©·ï·ç®¸- ®éï¼¶ç¸æ¢¯¬æ¸¸
- **ºè (backend/app.py)**:
  - ½æ¼è¿¤ `/api/statistics` äº¥å²· `get_events_count_by_category_and_tag` ³äº¦¿èä¹¿åç®è³è¿¤èç®¸åµå½è±¢
- **ºè (backend/endpoints/questionnaire.py)**:
  - ½æ¼è¿¤¹ç `update("set_tag|")` æ¾æ¹¤æ `")`  Bugç®¡è¥ï·ç®¸è¿¤æè©
  - ¸ç/æ¾ªç·ç¶½ªç·ç³é¿è¸é®ç©è½å¯§ç®¸æ½æ°æ¨ç©æ¨æ½®
  - ±çäº¤å®è­ææ¢ ID·ï·çæ­±çä¹©éï¼¹é
  - é§¯é¡ç `note` ºè¬æ¸¸- äº¦å½é½ç¿è¼»- 
  - ½æ¼è¿¤­ç¿æ¿æ¢è³£¿æ¯è¿é¿èï¼·ç- ®éºè¬æ¸¡¿åç®ç­¿è¼»»ç¿è¹å¾ç½âªæ
  - ½æ¼è¿¤¸éå¡äº¥æ¨æè³¢æ `pri_push('tag', '')` å¯ `update("set_tag|")` äº¦æ³µæ½
- **ºè (backend/migrate_rule_notes.py)**:
  - ç¥è¡¥æ¨æå®®ç©¿¸èé¤çµºè¬æ¸¡¸é- ¬æºè¬æç®½éªé­æ

## [2026-06-22] è©¨æï¼ºè
- ** (frontend/src/pages/RichMenu.jsx)**:
  - è©¨ææ¥«ï¼¶®åé¤æ¥¬å (¿è¼»½å)¿è¼»»å»èº«°æï¼·å³è¬å¶ï¼º®å
  - è©¨æ¿éè©¨æ¸ç¹è¸æ(æ¡½æè©)è¸¹é®å¸æ¾è¸æ¿éæ¸

## [2026-06-18] ¬è±¢½æ
- **ºè (backend/app.py)**:
  - ½æ¼è¿¤ /api/statistics è³¢èè³¢èç®¯æ¢¯è¡ U æ¼ 33  LINE User ID
- ** (RDS & 5014)**:
  - äº¤æ get_events_count_by_category_and_tag Functionè© LINE User ID ¹é¡è½é¡è¬éµå»è¡â

## [2026-06-18] ¼ç¢é³äç¥ªç®èå­
- **ºè (backend/endpoints/upload.py)**:
  -  GitHub ¼ç¢é³ä 1MB  5MB
  - ¢é 5MB ®èç® JSON ªç®è 413 æ½
- ** (frontend/src/pages/*.jsx)**:
  - å­µç¼ç¢éæ½ªç 413 (Payload Too Large) æ½­å¯æ¹è·ç¶½¼ç¢æ­æ¹é 5MB
  - è¸¹è¡è¬æ¿è§å½é³äæ¸¯è»â¥é

## [2026-06-18] è©¨æ Fallback ®èªèº«
- ** (backend/endpoints/broadcast.py)**:
  - `rich_menu_metadata` µå½æ¸¸ `permission_tags``fallback_message``alias_id` ¿éäº¤èæ¹
- **ºè (backend/endpoints/richmenu.py)**:
  - è©¨æªèæ¸¯é¬å³é
- ** (frontend/src/pages/RichMenu.jsx)**:
  - ±çè©¨æ¼å®åæ¸²è©»®å¥è·ç (Fallback)
  - ¨éè©¨äè©¨æäºå¯§ç¸èè¸µææ¢¯æ¢¯¸ï¼¹
  - ºé¿äº¦ç®è©¨æ´åå¯§çè©¨æè±¢æ©æè©¨æ
  - æ½ LINE ¸æè©¨æ´é¿é Postback æ¾­æ `menuID`°è¤è©¨æ¡ `permission_tags` (Python list ®é«æ) äº `fallback_message`ºè¡è«è°ç¼ï¼¸è©
  - è©¨æµå»äº¦ï¼¶è Fallback ®è¬è³¬

## [2026-06-18] ¬é®è¯æ¿è
- ** (frontend/src/pages/RuleDesigner.jsx)**:
  - é§äº
  - ¤è¸µæ¸¯ï¼¹ç®³æäº»æäº¤æ¿è§è¬è¿è¸¹¸èï¼¶éæ¹æ¸¡æ¸²æ­»é¿æ

## [2026-06-17] ¡è¬æ³æ½é
- ** (frontend/src/pages/Projects.jsx, Broadcast.jsx, RuleDesigner.jsx, RichMenu.jsx, LiffQuestionnaire.jsx, FlexMessageEditor.jsx)**:
  - «è¡è­å®ç¢æ°å¯¥ªç·ç¶½è¸¹æ­æ³ç¢é GitHub  Repo äºä¹ GitHub API ­æ
  - ¿æ¦æå¡ (5 MB)¶æ (50 MB) (30 MB)¬è³¢ (1 MB)è©¨æ (1 MB) (1 MB)

## [2026-06-17] è©¨æäº Link 
- ** (frontend/src/pages/RichMenu.jsx)**:
  - æ½¸èº«®è©¨¼åäº LINEç®äº LINEä¹©è Linkè³äº¤æ¹å¥æ¬è¥¿¡å¾åæ½¸ç¸å½å¥è¬æ

## [2026-06-17] è©¨æ¼è¹è¸è¬æ°æ
- **ºè (backend/endpoints/richmenu.py, backend/endpoints/customers.py)**:
  - «ç®¸æ½­è¤è¸è©¨æ¡°ç (`bulk_check_and_update_rich_menu`)
  -  `/api/customers/count-by-tags` ½æ½¸è¡¤å½å¡çè©
  - ºé¿è¼»»é®å (/·æ) æ½è©¨æ¼å¸æ½¸ªåæ½»è©¨æ¡
- ** (frontend/src/pages/RichMenu.jsx)**:
  - é§¹ç®åï¼
  - ºå»æ©è©¨¼åç¥ (°ç)
  - æ¸¸é´è±¢æ­¹éè¡®é¬è³¡®æ¶çè©
  - µå¶ï¼¸æ¹³è¹æ¿è

## [2026-06-16] Flex ¬æ°çæ¹
- ** (frontend/src/components/FlexMessageEditor.jsx)**:
  - æ¸¸å¸éµç®åäº¥è¸èè©¨æ
  -  payload «çå¡ `sys_bind|{tag}|{journey}|{menu}|{displayText}` ¯æ¹æ

## [2026-06-16] æ¢¢èªç®èæ¹
- **ºè (backend/endpoints/questionnaire.py)**:
  - ±çäºæ¢¢é´åªç·ç«æ¢¯¿è§ç

## [2026-06-12] superpages UI/UX Improvements
- **¡è¬å (App.jsx)**:
  - è¡æ¹§ç OA°å­µ½åè³
- **¸è (Projects.jsx)**:
  - ¶æ®èæ¥¶æ¬è³¢½çç® `preview_image_url` ¿è§çï¼ (poster)
  - ¤å¾èæ¥æ¢¯æ­æ duration æ¼²æ¿è§åå¯§ç¸éºè¡èªå«æ¬ç
- ** (RuleDesigner.jsx)**:
  - ½æ¼è¿¤ªâ¥çªé·æ¥èºâªå½åè³æ¥«ï¼¹¿å¸è·æ¸é¾èµå
  - ½éªæ±ç¬è·æ¥èäº¤é®èæ¥ç®è¡äº¤é (Loading Spinner) ³å½å¸é¿è¼»»æ
- **¢æ¤æ½¸ (Broadcast.jsx)**:
  - ½æ¼è¿¤¶æ®è¬è³¡ï¼·ç¶½¸è¹çç²¹ï·ç®¸®å¬è³¢ (poster)

## [2026-06-10] superpages dev-and-deploy-docker Update
  - ¤é®èæ¥¬å½å¤å¾èªè¸è«çæ¼²è¡æ°éè©¨äº¤
  - ¤é®èæ¥¬å½å¶æ³å®é¬è³¢è³
  -  unfollow ½å¥æ¿è§å ctive ½å®ç¯å½åæ¼
- **¢æ¤æ½¸ (Broadcast.jsx)**:
  - ¶æ®è¾å®é¬è³¢è³
  - ®è«äº¤äº¤æ°æäº¹æ³ç®è
- **®è­è (MessageCenter.jsx)**:
  - «çç®æ¤°æ¹§/ UI Bug
  - ½åå­ unfollow ­é¸é®èªæäº¤é¡ï·çæ¡½åæ­ follow ºè¸é«æ
- **ºè (backend/app.py)**:
  - æ¹ get_users_list  get_project_users API äº is_following ¡è¬æ½å­é©æ



### 2026-06-10
- **Feature**: ±ç\
ote\ ¿è¸æºè \- äº¦å½\
- **Feature**: ¡è (\Questionnaire.jsx\) æ¢ \äº¦å½\ ®ææ©¿è§è¯è«è
- **Feature**: \RuleDesigner.jsx\ ªâ¥çªæ¸è¸æ¢¯ \äº¦å½\ 

### 2026-06-10 Customer Center Updates
- **Feature**: °ï¼¸¡è¹å³æ¤æ (/)¸è¿è§é¯è©¨æ¡¿è§é«æ¤æ
- **Feature**: ºè customers.py  /api/customers/<user_id>/details  DELETE /api/customers/<user_id>/richmenu

- **BugFix**: ½æ¼è¿¤°ï¼¸¡è¹å³æ¸è SQL ¿èæ¢¢èªç (projects µå project_id  project_name)

- **Feature**: é¤çµ­æ¤éé¤¬è³¢®æ¼æ¹å¬æ¹§äº¤æä¹é¤æ¥µé

## [2026-06-22] ¢æ¤è©¨ªè¸è
### Added
- µå½ç½å ui_uuid  group_id ¿éäº¤èæ¸¸è©¨æ¡¢æ
- ¡è¬ç¿è©¨æ¡é» UIæ¸¯èè¼
- «æè±¢é®åè©¨æ´è³¬
- «å¸éµå½ç½æ

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
- **Bug Fix (2026-06-23)**: ½æ­å¸è©¨´æä¹¨å°è¬æ°æªæ·é targetTags ç®å¾æ¸¡æï¼·æ´ç¬â¥æ¿è§è½è¤æ

*   **customers API**: ½æè© /count-by-tags ¯æ¢¯­éæ¸¸æ¿åå¯§ç¬è±¢è©¨æè¡¨æè³ ()¿ç­ç®¸è²ç®

## 2026-06-25
- [ç¨  WebSocket  SIGNATURE_KEY ªè½éäº¦è©¨ Line-Bot-Main °å»è
## [2026-06-25] - Syslog Integration
### Added
- ´å NAS Syslogï¼½åè¨è¦å¾ç«¯æä½è¡ (°å¸å®ãä¿®æ¹åæ¡è¨­å¯å¥æç¨ç­)
- °å utils/syslogger.py  ReconnectingSSLSysLogHandlerï¼å° Syslog ¾ç½®¯å·èç·ï¼ç¢ºäç·ä¸ç©©æ API ä¸å½±é¿ã
- ¯æ´ç°åè® NAS_SYSLOG_APPNAME  Docker  Heroku ¨ç½²°å


## [2026-06-25] - Keyword Reply Duplicate Validation
### Added
- µåè¦ (RuleDesigner ç°¡ææ¨¡å): ²åªåæª¢æ¥æ¯å¦è¶äµåæ¨é¡è¤ï¼¥éè¤è·³åºæç¤ºå»ºè­°é¿åï¼¹ä¾¿å¾°ç®¡

## [Unreleased] - 2026-06-25
### Added
- ¸å®ç®¡ï¼°å°ä³ã½ã
- ¸å®ç®¡ï¼å»ºçæ®µå¥ä/ä¸­çè¼¥å«é²å
- ¸å®ç®¡ï¼å°å®ç¶å®å°è±¡åå¥(è¨)ç­¥ï¥å¨éå¥½åå¥(ALL_USERS)å®æ¨ç±¤ç¸ææ©¶ã
### Fixed
- ¸å®ç®¡ï¼ä¿®æ­£¸æªå»ºç«³lineä¸ºç¾æç¨è¨­åUIè¼¯ã
- ¸å®ç®¡ï¼ä¿®å¾©ä¸¶å¥ç¡æé¡¯ç¤ºé¡ï¼¹ç¨å¨å useEffect ªåæª¢æ¥åå½±å
- µåè¨¯ä¸­å¿ï¼æ¿¾æ¨æªè¨­å® fallback message ¢ç [text] å­ä¸²ï¿å¶å¹²¾è¯ä¸­å¿±éµåçµ±è


## 2026-06-29
- **Feature**: å¯¦ä¸å®èªåç¨ªé¤é²åæ©¶ïªé¤åªåæª¢æ¥é¯çå®ä¸¦è·³ºæç¤ºïå¾æ¸ç©ºç¸éè³ (Cascade Clear)
- ¸è·æå¡æ¡°å¹æ·ç°æç®¸æ¶æ¢¢è¼¸æ(: ®è¯XXX)


## [2026-06-30] ç³»çµ± UI å° BUG ªå
- **ç« (frontend/src/pages/Projects.jsx, RichMenu.jsx, Broadcast.jsx, RuleDesigner.jsx, components/JourneyPreview.jsx, index.css)**:
  - 1. Projects.jsx: ç¨è¡¨ç©º LayoutDashboard ç¤ºæç¤ºïä»¥å alidateProjectForm °åç¨±éè¤¡éè¼¯ã
  - 2. RichMenu.jsx: ¨æä½ flex è¡ä¿®æ­£ whiteSpace: 'nowrap' ä»¥åå­è¡ï¼isDefault å¢ status === 'public' ¯æ´ïä»¥æ­£ç¢ºæ¸²è¨­çæ¨è¨
  - 3. RuleDesigner.jsx: è§¸ç¼éµåç´ KeywordTagInput ä»¶ïä½¿ç¨éé©ï¼ä¿®æ­£ .card list item  onMouseLeave ¯é²éç½®éè¼¯ã
  - 4. Broadcast.jsx: ¼éå°è±¡æç±¤ç¯©¸æ¿æ TagInput ä»¶ïä¿ singleSelect={true}
  - 5. index.css: èª¿æ´å¨å utton ºçæ¨å¼ï¼ paddingmin-width  flex ä½å± gap
  - 6. JourneyPreview.jsx: å­æ°æ³¡æ¨£å¼è¿½å whiteSpace: 'pre-wrap'ï¼ç¢ºäè¨¯æè¡æ­ç¢ºéè¦½ã

- **ç« (frontend/src/pages/RichMenu.jsx, Projects.jsx, RuleDesigner.jsx, MessageCenter.jsx)**:
  - RichMenu.jsx: ä¿®æ­£ loading ®ç½© LoadingSpinner ä½¿ç¨æ¹å
  - Projects.jsx: ¥æç¨ç¨±å·²å­¨ïç²¾æé¡¯ç¤ºå°¯èª¤ï¼ä¸é¡¯ç¤ºè«è£é½å¿å¡«æä½
  - RuleDesigner.jsx: µåä» KeywordTagInput å¢æ¿¾ç©º¼èï¼²å²ç©º½ã
  - MessageCenter.jsx: ¨èå¤©å®¤æ¨ç±¤åªé¤æ style ä¸­å¼·¶è minWidth: 'auto' ¿å¶ç¹¼¿å¨å button å¤§å


## [2026-06-30] ç²¾æäºä»¶é­è²¼æ­¥èªçæ©
- **ç« (components/UserAvatar.jsx, pages/CustomerCenter.jsx, pages/MessageCenter.jsx)**:
  - °å UserAvatar.jsx çµä»¶ïä»¥å¯¦¾åè¼å¤±æ¯éæ­¥å·æ°é­è²¼é¡¯ç¤º°è Icon  Placeholder
  - ¿æå®¢æ¶ä¸­å¿ï¼CustomerCenter.jsxï¼è¡¨è´éæ¬­è²¼
  - ¿æè¨¯ä¸­å¿ï¼MessageCenter.jsxï¼å¤©åè¡¨èå¤ Header ¨æ¶é­è²¼
- **å¾ç« (backend/endpoints/customers.py)**:
  - °å 
efresh-profile API ç«¯éï¼ LINE Profile ¥å°èä¸¦ä¸»´æ DB ä¸­ç 
ame  pic

  - UserAvatar.jsx: ä¿®æ­£ display: none å°´é¨åè¦½å¨äè§¸ç img onLoad äºä»¶çæ½¨æ¸² bugï¼¹ä»¥ opacity  position absolute è¼¥ã

  - backend/endpoints/customers.py: ªå refresh-profile ¥åå° LINE API 404 Not Found (å°å¥½å) ï¼è¿ 200 ç©ºå¼ï²é»åç« Console è­¦å±ã

  - backend/endpoints/customers.py: ä¿®æ­£²å LINE Profile  API ç«¯éè·¯å /v2/bot/profile/{userId}

  - frontend/src/components/UserAvatar.jsx: °å loading_refreshed ä»¥é²æ­¢­åè¼¥å¤±¡éªçèª¿ç¨è¿´
  - backend/endpoints/customers.py: ªå refresh_customer_profile °å¸¸ç·¶ï¿å Connection Leak
 
  
 -   2 0 2 6 - 0 7 - 0 1 :   U p d a t e   F l e x M e s s a g e E d i t o r   t o   p r i o r i t i z e   u i _ u u i d   o v e r   r i c h M e n u I d   w h e n   c o n f i g u r i n g   r i c h   m e n u s w i t c h   f o r   f l e x   m e s s a g e   b u t t o n s   t o   e n s u r e   w e b h o o k   r e c e i v e s   t h e   c o r r e c t   U U I D   f o r m a t .  
 -   2 0 2 6 - 0 7 - 0 1   ( H o t f i x ) :   F i x   R e a c t   o p t i o n   r e n d e r i n g   i n   F l e x M e s s a g e E d i t o r   a n d   R u l e D e s i g n e r   b y   s e t t i n g   f a l l b a c k   \  a l u e = { m . u i _ u u i d   | |   ' ' } \   t o   p r e v e n t   t h e   b r o w s e r   f r o m   d e f a u l t i n g   t o   t h e   r i c h   m e n u   n a m e   w h e n   \ u i _ u u i d \   i s   n u l l / u n d e f i n e d .  
 
## [2026-07-06] ¸å®éè¨­çç¨è¼¯éæ§
- ä¿®æ­£: \ackend/endpoints/richmenu.py\ ç§»é¤ä \save_rich_menu_metadata\  \set_default_rich_menu\ ²åå¼·å¶å¶äè¨­é¸å®éç´ \published\ è¼¯ã
- °å: \save_rich_menu_metadata\  \set_default_rich_menu\ ä¸­å¥æ²åæª¢æ¥ï¶è¨­å®ç¨è¨­æ¥æ¶äè¨­æç¨ï¼å° 400 ¯èª¤
- è®: \check_and_apply_scheduled_rich_menus\ ¥äªåç´æ©¶ïè¨­é¸å®æªå´æ°ç \published\
- è®: \rontend/src/pages/RichMenu.jsx\ ¤æ UI ä¸ªäå¼µé¸å®æè©²è¢«æ¨ç¤ºçºãè¨­ã¾å¨ææ¯å°ç¨®åï¼ªå°éé¡¯ç¤ººãç¨å¾

## [2026-07-07] Customer Center UI Fixes & LIFF Tag Format
- ×¥ CustomerCenter.jsx kTÉ¡A]Ò°}CQ~]Å¦rÓ¾É­PeİµeY (Âµe) DC
-  CustomerCenter.jsx ¤WC@ onScroll Æ¥AÏ¥ÎªÌºuÊ¨ì©³É¦Û°Ä²oJÑ¾lW (Infinite Scroll)C
- ×¥ liff_questionnaire.py gJİ¨Ò¦ Private_var ÆªÉ¡A~Ï¥ str() É­PDtÎµLk json.loads TÑªR BugFwï¬°Î¤@Ï¥ json.dumps(..., ensure_ascii=False) ixsC

## [2026-07-07] Customer Center Background Loading Fix
- ×¥GN CustomerCenter.jsx  Infinite Scroll ^**IJ (Chunked Background Fetch)**C]eİ·jMOwgJbOé¤¤}CApGOİ­nUuÊ¤~J]Infinite Scroll^A|É­P|JÏ¥ÎªÌ¦bjMÉµLkQC{b|bì¦¸iJÉ¦Û°Ê¤JÒ¦Æªì§¹ATOjM\iHÎ¤C

 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   -N¡{t_ïzBfhV°eX  c r o n _ t a b l e _ c h e c k e r 
 -   °eX  b a c k e n d / u t i l s / s c h e d u l e r . p y -N¡{tofczhV0
 -   ,dy  p r o j e c t _ s t a t s _ p r o c e s s o r     r i c h _ m e n u _ s c h e d u l e r _ p r o c e s s o r   _  a p p . p y     s c h e d u l e r . p y 0
 -   °eX  c r o n _ t a b l e _ c h e c k e r   ÏkR[BfT@b	gwQ
kP:OghV|v  c h e c k _ c r o n _ t a b l e   w e b s o c k e t   NöN0
 -   yd  a p p . p y   -N
	gcz/¾|!|;Nz_0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   îOck²}rTA I mß[©RtbU I 
 -   yd0*gOR[b_MbËYÕRå]0eW[0
 -   \Hrb9eºp  f i x e d   [MOºxİOæ]tPkTBfNg b;NgQ¹[@SJXOPy0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   îOck  c r o n _ t a b l e _ c h e c k e r   |vOUL
 -   îOck(WwQ	gYP  O A   qQ(uøvT  s o c k e t _ u r l   :OghVvÅ`ÁlNg|v  W e b S o c k e t   NöNvOUL9eåN  s e t ( )    }&N\ÏkPhsËz:OghVÅP|v N!k0 
 
 # #   [ 2 0 2 6 - 0 7 - 1 5 ]   îOck  G u n i c o r n   Y  W o r k e r   ÷WL  S c h e d u l e r   OUL
 -   N  U D P   S o c k e t   }[,g0W  P o r t   ( 4 7 2 0 0 )   æ[\OLz  ( C r o s s - p r o c e s s   L o c k ) 0
 -   ºxİO!q  G u n i c o r n   _UÕRY\P  W o r k e r T NğS_jhV
NêS	g NP  W o r k e r   g÷WLofczMQíwBfgQ|vQ  t i m e r   Bl0 
 

## [2026-07-15] æ›´æ–°ç™»å‡ºæ™‚é•·
- å°‡å‰ç«¯è‡ªå‹•ç™»å‡ºæ©Ÿåˆ¶ç”±é–’ç½® 30 åˆ†é˜æ”¹ç‚º 1 å¤© (24å°æ™‚)

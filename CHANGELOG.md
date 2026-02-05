# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- **Statistics Integration**: Consolidated standalone statistics functionality into the `Projects.jsx` page. Global statistics (Trends, Keywords) are now visible by default in the "stats" tab when no project is selected, alongside project-specific metrics. Removed the redundant `Statistics.jsx` page and associated route from `App.jsx`.
- **Project Import Isolation Fix**: Resolved issue where different projects shared the same message tags. Each project now gets unique cloned tags during import.
- **Flex Message Editor Stability**: Fixed oscillating template states and UI flickers using semantic normalization and initialization guards.
- **Flex Message Editor Fix**: Improved auto-save reliability to prevent infinite loops.
- **Improved Project Page UI**: Replaced CSS Grid with Flexbox in "Add Project" form to prevent overlapping of fields at high zoom levels (150%+), ensuring a responsive layout.
- Fixed bug in Advanced Message Editor: Prevented overwriting of QA tag with preview text during schedule editing, ensuring saved Rich Messages can be correctly reloading and edited.
- Improved Lottery Management: Added "Registered Users" tab to display user list (Name + Avatar).
- Improved Lottery Management: Game status and ticket list now automatically refresh after actions (e.g., Start Game).
- Added Game Status display in Lottery Management (抽獎管理).
- Added functionality to delete prizes (tickets) in Lottery Management.
- Added new backend endpoints: `GET /api/game-status` and `DELETE /api/tickets/<id>`.
- Improved Message Center UI: `sys_reply` messages are now right-aligned and display only content without filters.
- **Improved Project Management**: "Manual Participants" list now correctly fetches users with name and picture from `Private_var` instead of `person_table`.
- **Improved Message Center**: `sys_reply` messages containing JSON (e.g., `{"text": "...", "type": "..."}`) are now parsed to display only the text content in Traditional Chinese.
- **Improved Message Center**: Enhanced Tag Input to support selecting existing tags (via dropdown) or entering new ones, and increased input width for better usability.
- **Improved Message Center**: Tags (both in display and dropdown menu) are now displayed without surrounding brackets or quotes (e.g., `['tag']` becomes `tag`), ensuring cleaner UI.
- **Improved Lottery Management**: "Registered Users" list now fetches from `person_table` and displays only the user's name, providing a cleaner view for lottery purposes.
- **Improved Message Center**: `sys_reply` messages can now display images, videos, audio, and simplified Flex messages (instead of raw JSON text), providing a better preview of bot responses.
- **Backend**: `/api/history/<user_id>` fetches chat history from `history:{app_id}` table.
- Initial creation of CHANGELOG.md and ARCHITECTURE.md.

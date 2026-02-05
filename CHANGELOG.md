# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Fixed bug in Advanced Message Editor: Prevented overwriting of QA tag with preview text during schedule editing, ensuring saved Rich Messages can be correctly reloading and edited.
- Improved Lottery Management: Added "Registered Users" tab to display user list (Name + Avatar).
- Improved Lottery Management: Game status and ticket list now automatically refresh after actions (e.g., Start Game).
- Added Game Status display in Lottery Management (抽獎管理).
- Added functionality to delete prizes (tickets) in Lottery Management.
- Added new backend endpoints: `GET /api/game-status` and `DELETE /api/tickets/<id>`.
- Initial creation of CHANGELOG.md and ARCHITECTURE.md.

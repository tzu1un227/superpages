---
description: 本 Workflow 規範了 Superpages 的功能修改與自動化部署流程。
---

### 第一階段：需求分析與確認 (Requirements Analysis)
1. **接收修改指令**：根據使用者在對話中提供的具體修改需求進行作業。
2. **邏輯確認**：若指令內容模糊、邏輯缺少或有疑慮，**必須先詢問使用者**，不得自行通靈。
3. **影響評估**：確認修改範圍，並嚴格遵守**禁止修改 `Line-Bot-Main` 專案**的原則（該專案僅作為串接回訊系統使用）。

### 第二階段：程式開發與文件更新 (Development & Documentation)
1. **執行修改**：依照需求對 `superpages` 的前端 (`frontend`) 或後端 (`backend`) 進行程式碼調整。
2. **更新架構文件與日誌**：
   - 每次修改程式碼後，**必須同步編輯** `ARCHITECTURE.md` 與 `CHANGELOG.md`。
   - **操作規範**：優先使用「讀取後附加 (Append)」的方式，避免覆蓋既有內容。
   - 內容應包含本次修改的功能、受影響的模組、以及對應的日期與版本。

### 第三階段：代碼同步與部署 (Git & Docker Deployment)
// turbo-all
1. **提交變更 (Git Commit)**：
   - 使用 `git add .` 與 `git commit -m "Update: [功能簡述]"`。
   - 執行 `git push` 將代碼同步至 GitHub 倉庫。
2. **執行部署腳本**：
   - 執行本地部署批次檔：`C:\Users\70640\Desktop\superpages.bat`。
   - 此步驟將會觸發 Docker 容器的重新構建與部署。

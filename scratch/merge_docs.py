import os

root_changelog_path = r'c:\Users\70640\Documents\GitHub\superpages\CHANGELOG.md'
docs_changelog_path = r'c:\Users\70640\Documents\GitHub\superpages\docs\CHANGELOG.md'
root_arch_path = r'c:\Users\70640\Documents\GitHub\superpages\ARCHITECTURE.md'
docs_arch_path = r'c:\Users\70640\Documents\GitHub\superpages\docs\ARCHITECTURE.md'

# Read files
with open(root_changelog_path, 'r', encoding='utf-8') as f:
    root_cl = f.read()
    
with open(docs_changelog_path, 'r', encoding='utf-8') as f:
    docs_cl = f.read()

# Merge CHANGELOG
# Find the start of the January records in docs_cl
jan_index = docs_cl.find('## [2026-01-29]')
if jan_index != -1:
    jan_records = docs_cl[jan_index:]
else:
    jan_records = ""

# Find the 2026-05-18 entry in docs_cl
docs_may_18_entry = "- 移除不再使用的 `web-dashboard` 資料夾 (原先用作登入系統的參考)。"

# Modify root_cl to include the web-dashboard entry
root_may_18_idx = root_cl.find('## [2026-05-18]')
if root_may_18_idx != -1:
    insert_pos = root_cl.find('\n', root_may_18_idx) + 1
    root_cl = root_cl[:insert_pos] + "- **移除清理**:\n  " + docs_may_18_entry + "\n" + root_cl[insert_pos:]

combined_cl = root_cl + "\n" + jan_records

with open(docs_changelog_path, 'w', encoding='utf-8') as f:
    f.write(combined_cl)

# Merge ARCHITECTURE
with open(root_arch_path, 'r', encoding='utf-8') as f:
    root_arch = f.read()

with open(docs_arch_path, 'r', encoding='utf-8') as f:
    docs_arch = f.read()

# Extract from docs_arch
start_frontend = docs_arch.find('## Frontend')
# everything from ## Frontend onwards
docs_arch_sections = docs_arch[start_frontend:]

# Replace root_arch System Overview with a combined one
overview_start = root_arch.find('## System Overview')
overview_end = root_arch.find('## Scheduled Event Management')

combined_overview = """## System Overview
The Superpages application is a full-stack web application with a Flask (Python) backend and a React frontend, designed for managing automation schedules, broadcasting messages, and monitoring system statuses. It integrates with a PostgreSQL database and uses Socket.IO for real-time communication.

"""

combined_arch = root_arch[:overview_start] + combined_overview + docs_arch_sections + "\n\n" + root_arch[overview_end:]

with open(docs_arch_path, 'w', encoding='utf-8') as f:
    f.write(combined_arch)

print("Merge completed.")

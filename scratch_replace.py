import os

filepath = 'frontend/src/pages/MessageCenter.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("m.content.startsWith('bmcast|')", "m.content.startsWith('bmcast|') || m.content.startsWith('cron|')")
# There's one place where we accidentally made it duplicated: m.content.startsWith('bmcast|') || m.content.startsWith('cron|') || m.content.startsWith('cron|')
content = content.replace("m.content.startsWith('bmcast|') || m.content.startsWith('cron|') || m.content.startsWith('cron|')", "m.content.startsWith('bmcast|') || m.content.startsWith('cron|')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")

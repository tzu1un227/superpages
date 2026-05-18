with open(r'c:\Users\70640\Documents\GitHub\superpages\frontend\src\pages\Broadcast.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if 'fetchBroadcasts' in line or 'setInterval' in line or 'useEffect' in line:
        print(f"Line {idx+1}: {line.strip()}")

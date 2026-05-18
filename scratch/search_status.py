with open(r'c:\Users\70640\Documents\GitHub\superpages\frontend\src\pages\Broadcast.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if 'bc.status' in line or 'status' in line and '===' in line:
        print(f"Line {idx+1}: {line.strip()}")

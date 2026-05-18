with open(r'c:\Users\70640\Documents\GitHub\superpages\backend\endpoints\broadcast.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for idx, line in enumerate(lines):
    if 'cache' in line or 'Cache' in line:
        print(f"Line {idx+1}: {line.strip()}")

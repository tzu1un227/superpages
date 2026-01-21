import os

if os.path.exists('params.log'):
    with open('params.log', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        if lines:
            # Print ALL lines to see history, but specifically parse START
            for line in lines[-2:]: # last 2 lines
                if 'DEBUG_API' in line:
                    parts = line.split(',')
                    for p in parts:
                        if 'start=' in p or 'end=' in p:
                            print(f"FOUND: {p.strip()}")
        else:
            print("params.log is empty")
else:
    print("params.log not found")

import os

if os.path.exists('params.log'):
    with open('params.log', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        if lines:
            last_line = lines[-1]
            print(f"LAST LINE RAW: {last_line[:100]} ...") # print start
            # parse it manually to be safe
            parts = last_line.split(',')
            for p in parts:
                print(f"PARAM: {p.strip()}")
        else:
            print("params.log is empty")
else:
    print("params.log not found")

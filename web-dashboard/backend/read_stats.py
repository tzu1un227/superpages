import os

if os.path.exists('query_stats.log'):
    with open('query_stats.log', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        if lines:
            print(f"LAST LINE: {lines[-1].strip()}")
        else:
            print("Log empty")
else:
    print("Log not found")

import os

if os.path.exists('query_stats.log'):
    with open('query_stats.log', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        if lines:
            line = lines[-1]
            try:
                # Format: "Query Result Count: 30 for URL: ..."
                count = line.split('Count: ')[1].split(' ')[0]
                print(f"COUNT: {count}")
            except:
                print(f"PARSE ERROR: {line[:50]}")
        else:
            print("Log empty")
else:
    print("Log not found")

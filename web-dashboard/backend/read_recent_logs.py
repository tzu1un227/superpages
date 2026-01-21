import os

print("--- DB ERROR LOG ---")
if os.path.exists('db_error.log'):
    with open('db_error.log', 'r', encoding='utf-8') as f:
        print(f.read())
else:
    print("None")

print("\n--- QUERY STATS LOG (Last 3 lines) ---")
if os.path.exists('query_stats.log'):
    with open('query_stats.log', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for line in lines[-3:]:
            print(line.strip())
else:
    print("None")

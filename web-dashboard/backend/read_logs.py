import os

print("--- PARAMS.LOG ---")
if os.path.exists('params.log'):
    with open('params.log', 'r', encoding='utf-8') as f:
        print(f.read())
else:
    print("params.log not found")

print("\n--- DB_ERROR.LOG ---")
if os.path.exists('db_error.log'):
    with open('db_error.log', 'r', encoding='utf-8') as f:
        print(f.read())
else:
    print("db_error.log not found")

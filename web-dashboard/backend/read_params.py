try:
    with open('params.log', 'r', encoding='utf-8') as f:
        content = f.read()
    # Split by comma and print each param on new line
    parts = content.split(',')
    for p in parts:
        print(p.strip())
except Exception as e:
    print(e)

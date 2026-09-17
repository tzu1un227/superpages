import os
import ast

backend_dir = 'backend'
results = []

for root, _, files in os.walk(backend_dir):
    for f in files:
        if f.endswith('.py') and not f.startswith('test') and 'scratch' not in root:
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as fp:
                try:
                    tree = ast.parse(fp.read(), filename=filepath)
                except Exception as e:
                    continue
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    route_dec = None
                    has_auth = False
                    has_admin = False
                    for d in node.decorator_list:
                        s = ast.dump(d)
                        if 'route' in s:
                            route_dec = s
                        if 'token_required' in s:
                            has_auth = True
                        if 'admin_required' in s:
                            has_admin = True
                    if route_dec:
                        results.append({
                            'file': filepath,
                            'func': node.name,
                            'line': node.lineno,
                            'has_auth': has_auth,
                            'has_admin': has_admin
                        })

unauth = [r for r in results if not r['has_auth'] and not r['has_admin']]
print(f"Total endpoints found: {len(results)}")
print(f"Unauthenticated endpoints: {len(unauth)}")
for u in unauth:
    print(f"{u['file']}:{u['line']} -> {u['func']}")

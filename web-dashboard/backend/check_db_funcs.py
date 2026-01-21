import psycopg2

url = 'postgres://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6'

try:
    print("Connecting...")
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    
    print("Checking functions...")
    cur.execute("""
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_type='FUNCTION' 
        AND routine_schema='public';
    """)
    funcs = cur.fetchall()
    found_funcs = [f[0] for f in funcs]
    print(f"Functions found in public schema: {found_funcs}")
    
    required_funcs = ['get_events_count_by_category_and_tag', 'get_keyword_ranking']
    missing = [f for f in required_funcs if f not in found_funcs]
    
    if missing:
        print(f"MISSING FUNCTIONS: {missing}")
    else:
        print("All required functions present.")
        
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"Connection or Query Error: {e}")

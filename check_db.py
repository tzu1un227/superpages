import psycopg2

conn = psycopg2.connect('postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2')
cur = conn.cursor()
try:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects:yzulabuse'")
    print("PROJ_COLS:", cur.fetchall())
except Exception as e:
    print(e)

cur.close()
conn.close()

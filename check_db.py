import psycopg2

conn = psycopg2.connect('postgresql://postgres:0000@140.138.176.197:5432/superpages')
cur = conn.cursor()
try:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects:yzulabuse'")
    print("PROJ_COLS:", cur.fetchall())
except Exception as e:
    print(e)

cur.close()
conn.close()

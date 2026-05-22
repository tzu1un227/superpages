import psycopg2
DB_URL = 'postgresql://postgres:0000@140.138.176.197:5432/5013'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute('SELECT * FROM "history:5013" LIMIT 1')
print(cur.fetchone())

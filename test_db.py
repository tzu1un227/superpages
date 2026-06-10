import psycopg2
conn = psycopg2.connect('postgresql://yzuirl:yzu70640@140.138.176.197:5432/yzuirl')
cur = conn.cursor()
cur.execute('SELECT DISTINCT name FROM "Private_var:tzu1un227/superpages"')
rows = cur.fetchall()
print([r[0] for r in rows])

cur.execute('SELECT * FROM "project_users:tzu1un227/superpages" LIMIT 1')
rows = cur.fetchall()
print(rows)

cur.execute('SELECT * FROM "projects:tzu1un227/superpages" LIMIT 1')
rows = cur.fetchall()
print(rows)

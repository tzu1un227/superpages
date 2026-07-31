import os
import psycopg2
from psycopg2.extras import RealDictCursor

RDS_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

conn = psycopg2.connect(RDS_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC")
tables = [r['table_name'] for r in cur.fetchall()]

print(f"Total tables found: {len(tables)}")
print("Sample tables:")
for t in tables[:30]:
    print(" -", t)

cur.close()
conn.close()

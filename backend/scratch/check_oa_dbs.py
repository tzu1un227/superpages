import os
import psycopg2
from psycopg2.extras import RealDictCursor

RDS_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

conn = psycopg2.connect(RDS_URL)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings ORDER BY id ASC")
oas = cur.fetchall()

print(f"Total OA Configs in Main DB: {len(oas)}")
for oa in oas:
    print(f"OA ID: {oa['id']} | Name: {oa['oa_name']} | DB URL: {oa['db_url']} | Other: {oa['other_settings']}")

cur.close()
conn.close()

import psycopg2

conn = psycopg2.connect("postgresql://postgres:0000@140.138.176.197:5432/5013")
cur = conn.cursor()
sql = 'INSERT INTO "Q_bank:5013" ("content", "state_in", "type", "msg_rpy", "function", "state_out", "history", "check") VALUES (%s, %s, %s, %s::json[], %s, %s, %s, %s) RETURNING id'
try:
    cur.execute(sql, (['test_val'], ['*'], 'Message', ['"hi"'], '', '00000', True, ['']))
    print("SUCCESS id:", cur.fetchone()[0])
    conn.rollback()
except Exception as e:
    print("ERROR:", e)
conn.close()

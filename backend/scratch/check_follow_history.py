import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def check_db():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Q_bank:%'")
    tables = [r['table_name'] for r in cur.fetchall()]
    print(f"Found Q_bank tables in 5013 DB: {tables}")
    
    for t in tables:
        cur.execute(f'SELECT id, type, content, history, note FROM "{t}" WHERE type = \'Follow\'')
        rows = cur.fetchall()
        print(f"Table {t} Follow rules count: {len(rows)}")
        for r in rows:
            print(f"  ID: {r['id']}, Note: {r.get('note')}, Content: {r['content']}, History: {r['history']} (type: {type(r['history'])})")
    conn.close()

if __name__ == '__main__':
    check_db()

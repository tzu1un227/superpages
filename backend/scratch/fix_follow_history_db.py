import psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

def fix_history():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Q_bank:%'")
    tables = [r['table_name'] for r in cur.fetchall()]
    print(f"[FIX] Target Q_bank tables: {tables}")
    
    for t in tables:
        cur.execute(f'UPDATE "{t}" SET history = TRUE WHERE type = \'Follow\'')
        updated_count = cur.rowcount
        print(f"[FIX] Updated {updated_count} Follow rows in \"{t}\" to history = TRUE")
    
    conn.commit()
    conn.close()
    print("[FIX] Completed database repair!")

if __name__ == '__main__':
    fix_history()

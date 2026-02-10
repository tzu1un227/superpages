import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def check_project_stats():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT project_id, project_name FROM projects")
    rows = cur.fetchall()
    projects = {p['project_id']: p['project_name'] for p in rows}

    cur.execute("SELECT name, value FROM \"Global_var:5013\" WHERE name LIKE 'pj:%:stats:%'")
    stats_rows = cur.fetchall()
    
    grouped = {}
    for s in stats_rows:
        parts = s['name'].split(':')
        pid = int(parts[1])
        metric = parts[4]
        if pid not in grouped: grouped[pid] = {}
        if metric not in grouped[pid]: grouped[pid][metric] = 0
        try:
            grouped[pid][metric] += int(s['value'])
        except:
            pass
            
    for pid, s in grouped.items():
        name = projects.get(pid, f"Unknown ID {pid}")
        print(f"\n--- Project {pid}: {name} ---")
        for metric, val in s.items():
            print(f"- {metric}: {val}")
        
        # Denominator in app.py is stats['tc'] which is mapped from ttc
        # numerator is tcc if > 0 else cc
        ttc = s.get('ttc', 0)
        tcc = s.get('tcc', 0)
        cc = s.get('cc', 0)
        tc = s.get('tc', 0)
        
        # Current logic in app.py:
        # stats['tc'] = stats['ttc']
        # numerator = stats['tcc'] if stats['tcc'] > 0 else stats['cc']
        # rate = numerator / stats['tc']
        
        if ttc > 0:
            numerator = tcc if tcc > 0 else cc
            rate = (numerator / ttc) * 100
            print(f"Current Dashboard Rate ( (tcc||cc) / ttc ): {rate}%")
        else:
            print("ttc is 0, cannot calculate rate.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_project_stats()

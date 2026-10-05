import sys, os
sys.path.insert(0, r'c:\Users\70640\Documents\GitHub\superpages\backend')
from app import app
from models import OAConfig
from db_utils import get_db_connection
from psycopg2.extras import RealDictCursor

with app.app_context():
    oas = OAConfig.query.all()
    for oa in oas:
        app_name = oa.other_settings.get('app_name') if oa.other_settings else str(oa.id)
        if not app_name: app_name = str(oa.id)
        print(f"=== Checking OA: {oa.id} - {oa.oa_name} - app_name: {app_name} ===")
        try:
            conn = get_db_connection(oa.db_url)
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check Q_bank and QA_bank
            for prefix in ['Q_bank', 'QA_bank']:
                t_name = f"{prefix}:{app_name}"
                cur.execute(f"SELECT 1 FROM information_schema.tables WHERE table_name = %s", (t_name,))
                if cur.fetchone():
                    cur.execute(f'SELECT id, note, function FROM "{t_name}" WHERE function LIKE %s', ("%sys.now%",))
                    rows = cur.fetchall()
                    for r in rows:
                        fn = r['function']
                        if "+ '}\")" in fn or "+ '}\"" in fn or fn.endswith("+ '}\")") or "+ '}\")" in fn or "+ '}\"" in fn or "+ '}\")" in repr(fn) or "sys.now" in fn:
                            print(f"  [{t_name}] ID {r['id']} ({r.get('note')}): {fn}")
                            if "+ '}\")" in fn:
                                fixed_fn = fn.replace("+ '}\")", "+ '\"}\')")
                                cur.execute(f'UPDATE "{t_name}" SET function = %s WHERE id = %s', (fixed_fn, r['id']))
                                print(f"    -> FIXED TO: {fixed_fn}")
            conn.commit()
            conn.close()
        except Exception as e:
            print("Error:", e)

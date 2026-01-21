from app import create_app
from models import OAConfig
import psycopg2
from psycopg2.extras import DictCursor

app = create_app()
with app.app_context():
    # Get Test OA
    oa = OAConfig.query.filter_by(oa_name='test').first()
    print(f"Connecting to: {oa.db_url}")
    
    conn = psycopg2.connect(oa.db_url)
    conn.set_client_encoding('UTF8')
    cur = conn.cursor(cursor_factory=DictCursor)
    
    try:
        # Use known working query parameters
        # 2024-01-01 to 2025-12-31, Message, Week
        start = '2024-01-01 00:00:00+08'
        end = '2025-12-31 23:59:59+08'
        cat = 'Message'
        unit = '週'
        
        cur.execute("SELECT * FROM get_events_count_by_category_and_tag(%s::timestamptz, %s::timestamptz, %s, %s)", 
                    (start, end, cat, unit))
        
        rows = cur.fetchall()
        print(f"Row Count: {len(rows)}")
        
        if len(rows) > 0:
            first_row = rows[0]
            print("\n--- COLUMN NAMES ---")
            print(list(first_row.keys()))
            print("\n--- SAMPLE DATA ---")
            print(dict(first_row))
        else:
            print("No rows returned to inspect columns.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

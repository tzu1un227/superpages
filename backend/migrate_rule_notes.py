import os
import sys

# Setup environment to load DB correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_utils import get_main_db_connection

def migrate():
    conn = get_main_db_connection()
    cur = conn.cursor()
    
    try:
        # Find all Q_bank, AD_bank, QA_bank tables
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE 'Q_bank:%' OR table_name LIKE 'AD_bank:%' OR table_name LIKE 'QA_bank:%')
        """)
        
        tables = cur.fetchall()
        
        total_updated = 0
        for (table_name,) in tables:
            print(f"Checking table {table_name}...")
            
            # Check if 'note' column exists
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND column_name = 'note'
            """, (table_name,))
            if not cur.fetchone():
                continue
                
            # Update rows where note does not contain our special suffixes
            # Also handle NULL notes by coalescing to empty string
            query = f"""
                UPDATE "{table_name}"
                SET note = COALESCE(note, '') || ' - 關鍵字回覆'
                WHERE COALESCE(note, '') NOT LIKE '%關鍵字回覆%' 
                  AND COALESCE(note, '') NOT LIKE '%問卷管理%' 
                  AND COALESCE(note, '') NOT LIKE '%工程用法則%'
            """
            cur.execute(query)
            updated = cur.rowcount
            if updated > 0:
                print(f"  -> Updated {updated} rows in {table_name}")
            total_updated += updated
            
        conn.commit()
        print(f"\nMigration complete. Total updated rows: {total_updated}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    from dotenv import load_dotenv
    load_dotenv()
    migrate()


import psycopg2

DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def inspect():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Check person_table columns
        print("\n--- person_table columns ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'person_table'")
        columns = cur.fetchall()
        for col in columns:
            print(f"{col[0]} ({col[1]})")

        conn.close()
    except Exception as e:
        print(e)

if __name__ == "__main__":
    inspect()

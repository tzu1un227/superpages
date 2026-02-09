from app import app, db
from sqlalchemy import text

def run_migration():
    with app.app_context():
        # Add scheduled_at to cron_table
        try:
            with db.engine.connect() as conn:
                # Check if column exists first to avoid error? Or just try/except
                conn.execute(text("ALTER TABLE cron_table ADD COLUMN scheduled_at TIMESTAMP"))
                conn.commit()
                print("Added scheduled_at to cron_table")
        except Exception as e:
            print(f"Skipping scheduled_at column (might exist): {e}")

if __name__ == "__main__":
    run_migration()

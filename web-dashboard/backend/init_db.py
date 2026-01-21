from app import create_app
from models import db, User, Page, OAConfig
from config import Config

def init_db():
    app = create_app()
    with app.app_context():
        # Drop all tables to reset state (optional, can be commented out for production)
        # db.drop_all()
        
        # Create tables
        db.create_all()
        print("Created database tables.")

        # Seed Pages
        if not Page.query.filter_by(name='dashboard').first():
            dashboard_page = Page(name='dashboard', description='Main Dashboard')
            db.session.add(dashboard_page)
            print("Added 'dashboard' page.")

        # Seed Mock OAConfig
        # Using the same remote DB settings from Config just for testing connection logic later
        # In reality, this would be different per OA.
        # We'll use a placeholder URL for testing multi-account logic if we don't want to expose real credentials here repeatedly
        # or reuse the one from environment for the default OA.
        
        remote_db_url = Config.REMOTE_DB_URL
        if not remote_db_url:
            print("Warning: REMOTE_DB_URL not found in Config. Using placeholder.")
            remote_db_url = "postgresql://user:pass@localhost:5432/dbname"

        # Check if 'dashboard' page exists to link
        dashboard_page = Page.query.filter_by(name='dashboard').first()
        
        if not OAConfig.query.filter_by(oa_name='Default OA').first():
            oa1 = OAConfig(
                page_id=dashboard_page.id,
                oa_name='Default OA',
                db_url=remote_db_url,
                other_settings={'theme': 'default'}
            )
            db.session.add(oa1)
            print("Added 'Default OA' config.")
            
        # Commit to get IDs
        db.session.commit()
        
        # Reload OA Config to get ID
        oa1 = OAConfig.query.filter_by(oa_name='Default OA').first()

        # Seed Users
        # Admin
        admin_emails = ['wenhsing.kuo@gmail.com', 'u8503649@gmail.com']
        for email in admin_emails:
            if not User.query.filter_by(email=email).first():
                admin = User(
                    email=email,
                    name='Admin User',
                    role='admin',
                    allowed_oa_configs=[oa1.id]
                )
                db.session.add(admin)
                print(f"Added Admin user: {email}")

        # Regular User
        user_email = 'whkuo@ee.yzu.edu.tw'
        if not User.query.filter_by(email=user_email).first():
            user = User(
                email=user_email,
                name='Regular User',
                role='user',
                allowed_oa_configs=[oa1.id] # User has access to this OA
            )
            db.session.add(user)
            print(f"Added Regular user: {user_email}")

        db.session.commit()
        print("Database initialization completed.")

if __name__ == '__main__':
    init_db()

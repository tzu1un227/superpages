from app import app, db
from models import Page

def seed_pages():
    with app.app_context():
        print("Checking Page table...")
        current_pages = Page.query.all()
        print(f"Current pages count: {len(current_pages)}")
        for p in current_pages:
            print(f" - {p.id}: {p.name} ({p.description})")
            
        required_pages = [
            {'name': 'Statistics', 'description': '綜合數據'},
            {'name': 'MessageCenter', 'description': '訊息中心'},
            {'name': 'Projects', 'description': '專案與排程'},
            {'name': 'Broadcast', 'description': '群發訊息'},
            {'name': 'ScheduledEvents', 'description': '定時觸發'},
            {'name': 'PrizeStatus', 'description': '獎品查詢'},
        ]
        
        added = False
        for req in required_pages:
            exists = False
            for p in current_pages:
                if p.name == req['name']:
                    exists = True
                    break
            
            if not exists:
                print(f"Adding missing page: {req['name']}")
                new_page = Page(name=req['name'], description=req['description'])
                db.session.add(new_page)
                added = True
        
        if added:
            db.session.commit()
            print("Database updated with missing pages.")
        else:
            print("All required pages exist.")

if __name__ == "__main__":
    seed_pages()

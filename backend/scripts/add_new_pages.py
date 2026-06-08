import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from models import db, Page, OAConfig
from sqlalchemy import text
from app import app as backend_app

def add_new_pages():
    with backend_app.app_context():
        new_pages = [
            {"name": "SocialRadar", "description": "網路聲量雷達"},
            {"name": "AiInsight", "description": "AI 洞察助理"}
        ]
        
        added_ids = []
        for p_data in new_pages:
            existing = Page.query.filter_by(name=p_data['name']).first()
            if not existing:
                new_page = Page(name=p_data['name'], description=p_data['description'])
                db.session.add(new_page)
                db.session.flush() # Get ID
                print(f"Added page: {new_page.name} with ID {new_page.id}")
                added_ids.append(new_page.id)
            else:
                print(f"Page {p_data['name']} already exists with ID {existing.id}")
                added_ids.append(existing.id)
                
        db.session.commit()
        
        # Now add to all existing OAConfigs so users can see them
        if added_ids:
            oas = OAConfig.query.all()
            for oa in oas:
                current_page_ids = oa.page_ids or []
                # Ensure it's a list and we add missing IDs as string or int depending on existing data
                updated = False
                for pid in added_ids:
                    # Sometimes page_ids are stored as strings, sometimes ints
                    if pid not in current_page_ids and str(pid) not in current_page_ids:
                        # Append as integer, or convert to string if existing are strings
                        if current_page_ids and isinstance(current_page_ids[0], str):
                            current_page_ids.append(str(pid))
                        else:
                            current_page_ids.append(pid)
                        updated = True
                
                if updated:
                    oa.page_ids = current_page_ids
                    # Due to JSON mutation issue in SQLAlchemy, might need to reassign or flag modified
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(oa, "page_ids")
            
            db.session.commit()
            print("Updated OAConfigs with new pages.")
            
if __name__ == "__main__":
    add_new_pages()

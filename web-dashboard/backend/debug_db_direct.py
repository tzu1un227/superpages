from db_utils import get_events_count_by_category_and_tag
from models import OAConfig
from app import create_app
import sys

# Force print to flush
sys.stdout.reconfigure(line_buffering=True)

app = create_app()
with app.app_context():
    oa = OAConfig.query.filter_by(oa_name='test').first()
    print(f"Testing direct DB call for OA: {oa.oa_name}")
    print(f"URL: {oa.db_url}")
    
    # Use dummy dates suitable for the query
    start = "2024-01-01 00:00:00+08"
    end = "2025-12-31 23:59:59+08"
    
    try:
        results = get_events_count_by_category_and_tag(start, end, "Message", "週", db_url=oa.db_url)
        print(f"Results count: {len(results)}")
        print(results)
    except Exception as e:
        print(f"Caught unexpected top-level error: {e}")

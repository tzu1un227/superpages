import sys
import os
import json
import requests

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from models import OAConfig
from db_utils import get_db_connection

def simulate_get_richmenu():
    with app.app_context():
        oa = OAConfig.query.get(5)
        g.current_oa_id = 5
        g.current_db_url = oa.other_settings.get('db_url') or oa.db_url
        g.current_app_name = '5013'
        
        token = oa.other_settings.get('line_token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # 1. 向 LINE 取得選單
        resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers)
        menus = resp.json().get('richmenus', [])
        
        # 2. 查資料庫
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT rich_menu_id, ui_uuid, name FROM "rich_menu_metadata:5013"')
        db_rows = cur.fetchall()
        metadata_map = {r[0]: {'ui_uuid': r[1], 'name': r[2]} for r in db_rows}
        cur.close()
        conn.close()
        
        for menu in menus:
            rm_id = menu['richMenuId']
            meta = metadata_map.get(rm_id, {})
            menu['ui_uuid'] = meta.get('ui_uuid')
            print(f"\nLINE Menu: name='{menu.get('name')}', richMenuId='{rm_id}'")
            print(f"Mapped ui_uuid: '{menu.get('ui_uuid')}'")
            
            # 模擬前端 FlexMessageEditor.jsx 的 option value 取值:
            # const menuVal = m.ui_uuid || m.richMenuId || m.rich_menu_id || m.id;
            menuVal = menu.get('ui_uuid') or menu.get('richMenuId') or menu.get('rich_menu_id')
            print(f"-> Front-end Option Value would be: '{menuVal}'")

if __name__ == '__main__':
    simulate_get_richmenu()

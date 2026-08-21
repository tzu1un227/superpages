import sys
import os
import json
import requests

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app
from flask import g
from models import OAConfig
from endpoints.richmenu import get_tenant_conn, get_line_token

def test_api_mapping():
    with app.test_request_context('/api/richmenu/'):
        oa = OAConfig.query.get(5)
        g.current_oa_id = 5
        g.current_db_url = oa.other_settings.get('db_url') or oa.db_url
        g.current_app_name = '5013'
        
        token = get_line_token()
        print("Line token found:", bool(token))
        
        headers = {'Authorization': f'Bearer {token}'}
        resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers)
        menus = resp.json().get('richmenus', [])
        print(f"Fetched {len(menus)} rich menus from LINE")
        
        # 測試 metadata mapping 邏輯
        oa_id = 5
        metadata_map = {}
        m_conn = get_tenant_conn(oa_id=oa_id)
        if m_conn:
            t_metadata = f'"rich_menu_metadata:{g.current_app_name}"'
            m_cur = m_conn.cursor()
            m_cur.execute(f"SELECT rich_menu_id, ui_uuid, end_time, status FROM {t_metadata} WHERE oa_id = %s AND rich_menu_id IS NOT NULL", (oa_id,))
            for r in m_cur.fetchall():
                metadata_map[r[0]] = {
                    'ui_uuid': r[1],
                    'end_time': r[2].isoformat() if r[2] else None
                }
            m_cur.close()
            m_conn.close()
            
        print("metadata_map:", metadata_map)
        
        for menu in menus:
            meta_info = metadata_map.get(menu['richMenuId'], {})
            menu['ui_uuid'] = meta_info.get('ui_uuid')
            print(f"Menu: {menu.get('name')}, LINE richMenuId: {menu.get('richMenuId')}, ui_uuid: {menu.get('ui_uuid')}")

if __name__ == '__main__':
    test_api_mapping()

import os
import sys
import json
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

MAIN_DB_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")

# 支援傳入目標，預設比對 5013 (使用者指稱之 5013 / 9013)
TARGET_KEY = sys.argv[1] if len(sys.argv) > 1 else "5013"

def clear_rich_menus_for_target(target_key):
    print(f"=== [開始執行目標 \"{target_key}\" 的圖文選單與資料庫清空作業] ===")

    conn_main = psycopg2.connect(MAIN_DB_URL)
    cur_main = conn_main.cursor(cursor_factory=RealDictCursor)
    
    cur_main.execute("""
        SELECT id, oa_name, db_url, other_settings 
        FROM permission_settings 
        WHERE oa_name = %s OR (other_settings::jsonb ->> 'app_name') = %s OR id::text = %s
        LIMIT 1
    """, (target_key, target_key, target_key))
    
    oa_info = cur_main.fetchone()
    
    # Fallback to ID 5 (5013) if exact string 9013 match fails
    if not oa_info and target_key in ["9013", "5013"]:
        print(f"  ℹ️  搜尋 \"{target_key}\" 未獲匹配，自動導向專案 \"5013\" (ID: 5)...")
        cur_main.execute("SELECT id, oa_name, db_url, other_settings FROM permission_settings WHERE id = 5 OR oa_name = '5013'")
        oa_info = cur_main.fetchone()

    cur_main.close()
    conn_main.close()

    if not oa_info:
        print(f"❌ 錯誤: 在主資料庫 permission_settings 中找不到目標 \"{target_key}\" 的紀錄！")
        return

    oa_id = oa_info['id']
    oa_name = oa_info['oa_name']
    db_url = oa_info['db_url']
    other_settings = oa_info['other_settings'] or {}
    if isinstance(other_settings, str):
        try: other_settings = json.loads(other_settings)
        except: other_settings = {}
        
    app_name = other_settings.get('app_name', '5013')
    line_token = other_settings.get('line_token')

    print(f"✅ 定位帳號目標: ID={oa_id}, Name='{oa_name}', AppName='{app_name}'")
    print(f"  DB URL: {db_url}")

    # 1. 清理 LINE API 上的所有圖文選單與別名
    if line_token:
        headers = {'Authorization': f'Bearer {line_token}', 'Content-Type': 'application/json'}
        print("\n--- [步驟 1: 清理 LINE API 遠端圖文選單與別名] ---")
        
        # 解綁全域預設圖文選單
        try:
            del_def_resp = requests.delete('https://api.line.me/v2/bot/user/all/richmenu', headers=headers)
            print(f"  解綁 LINE 全域預設選單結果: Status {del_def_resp.status_code}")
        except Exception as e:
            print(f"  ⚠️ 解綁全域預設選單異常: {e}")

        # 刪除所有別名 (Aliases)
        try:
            alias_resp = requests.get('https://api.line.me/v2/bot/richmenu/alias/list', headers=headers)
            if alias_resp.status_code == 200:
                aliases = alias_resp.json().get('aliases', [])
                print(f"  找到 {len(aliases)} 個 Rich Menu 別名，開始清理...")
                for alias in aliases:
                    alias_id = alias.get('richMenuAliasId')
                    d_a_resp = requests.delete(f'https://api.line.me/v2/bot/richmenu/alias/{alias_id}', headers=headers)
                    print(f"    - 刪除別名 {alias_id}: Status {d_a_resp.status_code}")
        except Exception as e:
            print(f"  ⚠️ 清理別名異常: {e}")

        # 撈取並刪除所有 Rich Menu
        try:
            list_resp = requests.get('https://api.line.me/v2/bot/richmenu/list', headers=headers)
            if list_resp.status_code == 200:
                menus = list_resp.json().get('richmenus', [])
                print(f"  找到 {len(menus)} 個 LINE 遠端圖文選單，開始刪除...")
                for m in menus:
                    rm_id = m.get('richMenuId')
                    name = m.get('name')
                    d_m_resp = requests.delete(f'https://api.line.me/v2/bot/richmenu/{rm_id}', headers=headers)
                    print(f"    - 刪除選單 \"{name}\" ({rm_id}): Status {d_m_resp.status_code}")
            else:
                print(f"  ⚠️ 撈取 LINE 選單失敗: {list_resp.text}")
        except Exception as e:
            print(f"  ⚠️ 刪除 LINE 遠端選單異常: {e}")
    else:
        print("⚠️ 未設定 Line Token，跳過 LINE API 遠端清理。")

    # 2. 清理業務資料庫中的圖文選單表格
    print("\n--- [步驟 2: 清理業務資料庫中的圖文選單表格內容] ---")
    try:
        conn_tgt = psycopg2.connect(db_url)
        cur_tgt = conn_tgt.cursor(cursor_factory=RealDictCursor)
        
        # 尋找並清空所有包含 rich_menu_metadata 的表格
        cur_tgt.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'rich_menu_metadata%'
        """)
        rm_tables = [r['table_name'] for r in cur_tgt.fetchall()]
        
        for t_metadata in rm_tables:
            cur_tgt.execute(f'TRUNCATE TABLE "{t_metadata}" CASCADE;')
            print(f"  ✅ 成功清空表格 \"{t_metadata}\" 内容 (表格結構完美留存)")

        # 清理 Private_var rich_menu 綁定紀錄
        cur_tgt.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'Private_var%'
        """)
        pv_tables = [r['table_name'] for r in cur_tgt.fetchall()]
        for t_private in pv_tables:
            cur_tgt.execute(f'DELETE FROM "{t_private}" WHERE name = \'rich_menu\';')
            print(f"  ✅ 成功清理 \"{t_private}\" 中的個別選單綁定紀錄")

        # 清理 Global_var default_rich_menu 紀錄
        cur_tgt.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name LIKE 'Global_var%'
        """)
        gv_tables = [r['table_name'] for r in cur_tgt.fetchall()]
        for t_global in gv_tables:
            cur_tgt.execute(f'DELETE FROM "{t_global}" WHERE name = \'default_rich_menu\';')
            print(f"  ✅ 成功清理 \"{t_global}\" 中的全域預設選單紀錄")

        conn_tgt.commit()
        cur_tgt.close()
        conn_tgt.close()
        print(f"\n=== 目標 \"{target_key}\" ({app_name}) 的圖文選單及資料庫內容清理作業全數完成 ===")
    except Exception as e:
        print(f"❌ 業務資料庫清理失敗: {e}")

if __name__ == '__main__':
    clear_rich_menus_for_target(TARGET_KEY)

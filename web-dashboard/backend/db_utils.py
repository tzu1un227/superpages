import psycopg2
from typing import List, Dict
from psycopg2.extras import DictCursor
from config import Config

def get_events_count_by_category_and_tag(start_time: str, end_time: str, category: str, group_unit: str, db_url: str = None) -> List[Dict]:
    """
    呼叫遠端資料庫函式取得指定時間範圍內，單一類別和標籤的事件數量。
    """
    try:
        if db_url:
            conn = psycopg2.connect(db_url)
        else:
            conn = psycopg2.connect(
                host=Config.DB_HOST,
                port=Config.DB_PORT,
                user=Config.DB_USER,
                password=Config.DB_PASS,
                database=Config.DB_NAME
            )
        
        # DEBUG: Force URL
        # conn = psycopg2.connect('postgres://...')
        
        conn.set_client_encoding('UTF8')
        
        # 使用 DictCursor，這樣可以透過欄位名稱存取資料
        cur = conn.cursor(cursor_factory=DictCursor)

        # 使用 execute 呼叫函式
        cur.execute("SELECT * FROM get_events_count_by_category_and_tag(%s::timestamptz, %s::timestamptz, %s, %s)", 
                    (start_time, end_time, category, group_unit))

        # 將回傳的 row 物件，手動對應到前端期望的 dict key
        rows = cur.fetchall()
            
        results = [
            {"category": str(row['tag']), "tag": str(row['group_key']), "count": int(row['tag_count'])}
            for row in rows
        ]

        # 關閉資料庫連線
        cur.close()
        conn.close()

        return results

    except Exception as e:
        print(f"資料庫連線或查詢錯誤: {e}")
        return []    

def get_keyword_ranking(start_time: str, end_time: str, tag: str = '', limit: int = 150, db_url: str = None) -> List[Dict]:
    """
    呼叫遠端資料庫函式取得指定時間範圍內，關鍵字的排名。
    """
    try:
        if db_url:
            conn = psycopg2.connect(db_url)
        else:
            conn = psycopg2.connect(
                host=Config.DB_HOST,
                port=Config.DB_PORT,
                user=Config.DB_USER,
                password=Config.DB_PASS,
                database=Config.DB_NAME
            )
            
        conn.set_client_encoding('UTF8')
        
        cur = conn.cursor(cursor_factory=DictCursor)

        # 呼叫遠端資料庫函式
        cur.execute("SELECT * FROM public.get_keyword_ranking(%s::date, %s::date, %s, %s);", 
                    (start_time, end_time, tag, limit))

        # 獲取查詢結果
        # 使用列表推導式將 DictRow 直接轉換為 dict
        rows = cur.fetchall()
            
        results = []
        for row in rows:
            r = dict(row)
            for k, v in r.items():
                # manual stringify for dates to avoid json error
                if hasattr(v, 'isoformat'):
                    r[k] = v.isoformat()
            results.append(r)

        # 關閉資料庫連線
        cur.close()
        conn.close()
        
        return results

    except Exception as e:
        print(f"資料庫連線或查詢錯誤: {e}")
        return []

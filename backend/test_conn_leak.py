"""
連線外洩測試腳本
==============
模擬各種會導致 Exception 的場景，確認連線池 (Pool) 不會被耗盡。

使用方式: python test_conn_leak.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 模擬 Flask 的 g 物件
class FakeG:
    current_db_url = None
    current_oa_id = None

import psycopg2.pool

# 直接從 db_utils 匯入
from db_utils import db_pools, PooledConnectionWrapper, RDS_URL

def get_pool_stats(db_url=RDS_URL):
    """回傳目前池子的連線數量"""
    p = db_pools.get(db_url)
    if not p:
        return {"status": "no pool found"}
    # ThreadedConnectionPool 有 _used 和 _pool 屬性
    used = len(p._used)
    free = len(p._pool)
    return {"used": used, "free": free, "total": used + free}

def test_normal_usage():
    """測試 1: 正常使用 - conn 應該被歸還"""
    print("\n=== Test 1: 正常使用 ===")
    from db_utils import get_main_db_connection
    
    before = get_pool_stats()
    print(f"Before: {before}")
    
    conn = get_main_db_connection()
    during = get_pool_stats()
    print(f"During (1 conn in use): {during}")
    
    cur = conn.cursor()
    cur.execute("SELECT 1")
    cur.close()
    conn.close()  # 歸還
    
    after = get_pool_stats()
    print(f"After (should match before): {after}")
    assert after['used'] == before['used'], f"FAIL: used changed {before['used']} -> {after['used']}"
    print("PASS ✓")

def test_exception_recovery():
    """測試 2: 發生 Exception 時連線應被歸還"""
    print("\n=== Test 2: Exception 發生時的連線歸還 ===")
    from db_utils import get_main_db_connection
    
    before = get_pool_stats()
    print(f"Before: {before}")
    
    conn = None
    try:
        conn = get_main_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1/0")  # 故意觸發 DB Exception
        cur.close()
    except Exception as e:
        print(f"Exception caught (expected): {type(e).__name__}")
    finally:
        if conn: conn.close()  # 正確的 finally 寫法
    
    after = get_pool_stats()
    print(f"After (should match before): {after}")
    assert after['used'] == before['used'], f"FAIL: used changed {before['used']} -> {after['used']}"
    print("PASS ✓")

def test_old_bad_pattern():
    """測試 3: 模擬舊的危險寫法 - conn 在 try 外取得，cur.close() 失敗"""
    print("\n=== Test 3: 模擬舊的危險寫法（conn 在 try 外）===")
    from db_utils import get_main_db_connection
    
    before = get_pool_stats()
    print(f"Before: {before}")
    
    conn = get_main_db_connection()  # 危險：在 try 外面
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT 1/0")  # 故意觸發 Exception
    except Exception as e:
        print(f"Exception caught (expected): {type(e).__name__}")
        conn.rollback()
    finally:
        # 舊寫法：如果 cur 在取之前就出錯，這裡會 NameError
        try: cur.close()
        except: pass
        conn.close()  # 即使用舊寫法，只要有 close() 就安全
    
    after = get_pool_stats()
    print(f"After: {after}")
    assert after['used'] == before['used'], f"FAIL: used changed {before['used']} -> {after['used']}"
    print("PASS ✓")

def test_with_context_manager():
    """測試 4: 使用 with 語法（Context Manager）"""
    print("\n=== Test 4: with 語法 Context Manager ===")
    from db_utils import get_main_db_connection
    
    before = get_pool_stats()
    print(f"Before: {before}")
    
    try:
        with get_main_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT 1/0")  # 故意觸發 Exception
            cur.close()
    except Exception as e:
        print(f"Exception caught (expected): {type(e).__name__}")
    
    after = get_pool_stats()
    print(f"After (should match before): {after}")
    assert after['used'] == before['used'], f"FAIL: used changed {before['used']} -> {after['used']}"
    print("PASS ✓")

def test_pool_exhaustion_protection():
    """測試 5: 模擬 10 個並發請求 - Pool 應 NOT 被耗盡（max=10）"""
    print("\n=== Test 5: Pool 保護測試（最多 10 條連線）===")
    from db_utils import get_main_db_connection
    
    conns = []
    for i in range(10):
        try:
            c = get_main_db_connection()
            conns.append(c)
        except Exception as e:
            print(f"  Connection {i+1} failed: {e}")
            break
    
    print(f"  成功取得 {len(conns)} 條連線")
    during = get_pool_stats()
    print(f"  During (max usage): {during}")
    
    # 確認第 11 條會失敗（Pool 已滿）
    try:
        extra = get_main_db_connection()
        extra.close()
        print("  WARNING: 第 11 條連線竟然成功了，Pool 上限可能 >10")
    except Exception as e:
        print(f"  GOOD: 第 11 條連線正確被拒絕: {type(e).__name__}")
    
    # 全部歸還
    for c in conns:
        c.close()
    
    after = get_pool_stats()
    print(f"  After (all returned): {after}")
    assert after['used'] == 0, f"FAIL: {after['used']} connections not returned"
    print("PASS ✓")

if __name__ == '__main__':
    print("=" * 50)
    print("資料庫連線外洩測試")
    print("=" * 50)
    
    # 先初始化 pool
    from db_utils import get_main_db_connection
    try:
        conn = get_main_db_connection()
        conn.close()
        print("Pool 初始化成功")
    except Exception as e:
        print(f"Pool 初始化失敗，請確認 DB 連線: {e}")
        sys.exit(1)
    
    try:
        test_normal_usage()
        test_exception_recovery()
        test_old_bad_pattern()
        test_with_context_manager()
        test_pool_exhaustion_protection()
        
        print("\n" + "=" * 50)
        print("所有測試通過！連線池運作正常 ✓")
        print("=" * 50)
    except AssertionError as e:
        print(f"\n❌ 測試失敗: {e}")
        sys.exit(1)

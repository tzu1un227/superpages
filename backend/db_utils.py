
import psycopg2
from flask import g
import os
from psycopg2 import pool

# Configuration
RDS_URL = os.environ.get('DATABASE_URL', "postgresql://postgres:0000@140.138.176.197:5432/superpages")
if RDS_URL.startswith("postgres://"):
    RDS_URL = RDS_URL.replace("postgres://", "postgresql://", 1)

# Registry for pools
db_pools = {}

class PooledConnectionWrapper:
    """Context manager to ensure connection return and transaction integrity."""
    def __init__(self, pool_obj, conn):
        self._pool = pool_obj
        self._conn = conn
        self.cursor = self._conn.cursor
        self.commit = self._conn.commit
        self.rollback = self._conn.rollback

    def close(self):
        if self._conn and self._pool:
            try:
                # Ensure no hanging transaction
                self._conn.rollback()
                self._pool.putconn(self._conn)
            except:
                pass
            self._conn = None
            self._pool = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            try:
                self._conn.rollback()
            except:
                pass
        self.close()

    def __del__(self):
        self.close()

def get_db_stats():
    """Returns the current number of active connections for the main RDS."""
    try:
        with get_main_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT count(*) FROM pg_stat_activity")
            count = cur.fetchone()[0]
            return count
    except:
        return -1

def get_main_db_connection():
    # ... (rest of the file remains same)
    """Always connects to the RDS Main Database."""
    global db_pools
    if RDS_URL not in db_pools:
        try:
            db_pools[RDS_URL] = pool.ThreadedConnectionPool(1, 10, dsn=RDS_URL)
        except Exception as e:
            print(f"ERROR: Failed to create RDS pool: {e}")
            raise e
    
    conn = db_pools[RDS_URL].getconn()
    return PooledConnectionWrapper(db_pools[RDS_URL], conn)

def get_db_connection(db_url=None):
    """Get a database connection from a pool. Supports dynamic DB URLs."""
    if not db_url:
        db_url = getattr(g, 'current_db_url', None)
    
    # CRITICAL FIX: If we have an OA ID but no DB URL, do NOT fallback to RDS.
    # This happens if the Main RDS was too busy to provide the config during load_oa_context.
    oa_id = getattr(g, 'current_oa_id', None)
    if not db_url and oa_id:
        print(f"CRITICAL: Request for OA {oa_id} has no DB URL. Refusing to fallback to Main RDS.")
        raise Exception("系統連線繁忙，請稍後再試。")
    
    if not db_url:
        db_url = RDS_URL
    
    global db_pools
    if db_url not in db_pools:
        try:
            # We use a proper connection pool to support higher concurrency (min: 1, max: 10)
            db_pools[db_url] = pool.ThreadedConnectionPool(1, 10, dsn=db_url)
        except Exception as e:
            print(f"ERROR: Failed to create pool for {db_url}: {e}")
            raise e
    
    conn = db_pools[db_url].getconn()
    return PooledConnectionWrapper(db_pools[db_url], conn)

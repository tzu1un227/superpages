import psycopg2
from flask import g
import os
import queue
import threading
import time

# Configuration
RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

class SimplePool:
    def __init__(self, creator, max_size):
        self.creator = creator
        self.pool = queue.Queue(maxsize=max_size)
    
    def getconn(self):
        try:
            return self.pool.get(block=False)
        except queue.Empty:
            return self.creator()
    
    def putconn(self, conn):
        try:
            self.pool.put(conn, block=False)
        except queue.Full:
            conn.close()

db_pools = {}

class PooledConnectionWrapper:
    def __init__(self, pool_obj, conn):
        self._pool = pool_obj
        self._conn = conn
        self.cursor = self._conn.cursor
        self.commit = self._conn.commit
        self.rollback = self._conn.rollback

    def close(self):
        if self._conn and self._pool:
            try:
                self._pool.putconn(self._conn)
            except:
                pass
            self._conn = None
            self._pool = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __del__(self):
        self.close()

def get_main_db_connection():
    """Always connects to the RDS Main Database using a pool."""
    global db_pools
    if RDS_URL not in db_pools:
        try:
            # Increased to 2 for smoother performance as some other projects are deprecated
            db_pools[RDS_URL] = pool.ThreadedConnectionPool(1, 2, RDS_URL, connect_timeout=10)
        except Exception as e:
            print(f"ERROR: Failed to create RDS pool: {e}")
            raise e
    
    # Retry mechanism for exhausted pool
    retries = 10
    while retries > 0:
        try:
            conn = db_pools[RDS_URL].getconn()
            return PooledConnectionWrapper(db_pools[RDS_URL], conn)
        except pool.PoolError:
            retries -= 1
            if retries == 0:
                raise Exception("系統繁忙，請稍後再試。")
            import time
            time.sleep(0.5)
        except Exception as e:
            if "too many connections" in str(e).lower() or "pool is full" in str(e).lower():
                raise Exception("系統繁忙，請稍後再試。")
            raise e

def get_db_connection(db_url=None):
    """Get a database connection from a pool. Supports dynamic DB URLs."""
    if not db_url:
        db_url = getattr(g, 'current_db_url', None)
    
    if not db_url:
        # If no DB URL is provided, default to RDS_URL instead of localhost
        db_url = RDS_URL
    
    global db_pools
    if db_url not in db_pools:
        try:
            # Increased to 2 for smoother performance as some other projects are deprecated
            db_pools[db_url] = pool.ThreadedConnectionPool(1, 2, db_url, connect_timeout=10)
        except Exception as e:
            print(f"ERROR: Failed to create pool for {db_url}: {e}")
            raise e
    
    # Retry mechanism for exhausted pool
    retries = 10
    while retries > 0:
        try:
            conn = db_pools[db_url].getconn()
            return PooledConnectionWrapper(db_pools[db_url], conn)
        except pool.PoolError:
            retries -= 1
            if retries == 0:
                raise Exception("系統繁忙，請稍後再試。")
            import time
            time.sleep(0.5)
        except Exception as e:
            if "too many connections" in str(e).lower() or "pool is full" in str(e).lower():
                raise Exception("系統繁忙，請稍後再試。")
            raise e

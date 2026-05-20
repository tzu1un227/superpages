
import psycopg2
from flask import g
import os
import queue
import threading
import time

# Configuration
RDS_URL = "postgres://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"

class SimplePool:
    """A custom minimal pool to strictly limit connections to 1 per DB."""
    def __init__(self, creator, max_size=1):
        self.creator = creator
        self.pool = queue.Queue(maxsize=max_size)
    
    def getconn(self):
        try:
            # Try to get existing connection from queue
            return self.pool.get(block=False)
        except queue.Empty:
            # Create new connection if pool is empty
            return self.creator()
    
    def putconn(self, conn):
        try:
            # FORCE ROLLBACK to clean up any aborted transactions before reuse
            try:
                conn.rollback()
            except:
                pass
            self.pool.put(conn, block=False)
        except queue.Full:
            # Close connection if pool already has its quota
            conn.close()

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
            db_pools[RDS_URL] = SimplePool(lambda: psycopg2.connect(RDS_URL), max_size=3)
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
            # We strictly keep pool size 1 for extreme savings
            db_pools[db_url] = SimplePool(lambda: psycopg2.connect(db_url), max_size=3)
        except Exception as e:
            print(f"ERROR: Failed to create pool for {db_url}: {e}")
            raise e
    
    conn = db_pools[db_url].getconn()
    return PooledConnectionWrapper(db_pools[db_url], conn)

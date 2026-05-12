
import psycopg2
from flask import g
import os
import queue
import threading
import time

# Configuration
RDS_URL = "postgresql://u1kq1nhog5jq7b:pd1a6d947df93fb15d747bbadf399e84893f9fd5932782191f0b6ffa187c5ae18@c8lcd8bq1mia7p.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/d1hr8bloo29pm6"

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
            # Return connection to pool
            self.pool.put(conn, block=False)
        except queue.Full:
            # Close connection if pool already has its quota
            conn.close()

# Registry for pools
db_pools = {}

class PooledConnectionWrapper:
    """Context manager to ensure connection return."""
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
    """Always connects to the RDS Main Database."""
    global db_pools
    if RDS_URL not in db_pools:
        try:
            db_pools[RDS_URL] = SimplePool(lambda: psycopg2.connect(RDS_URL), max_size=1)
        except Exception as e:
            print(f"ERROR: Failed to create RDS pool: {e}")
            raise e
    
    conn = db_pools[RDS_URL].getconn()
    return PooledConnectionWrapper(db_pools[RDS_URL], conn)

def get_db_connection(db_url=None):
    """Get a database connection from a pool. Supports dynamic DB URLs."""
    if not db_url:
        db_url = getattr(g, 'current_db_url', None)
    
    if not db_url:
        db_url = RDS_URL
    
    global db_pools
    if db_url not in db_pools:
        try:
            db_pools[db_url] = SimplePool(lambda: psycopg2.connect(db_url), max_size=1)
        except Exception as e:
            print(f"ERROR: Failed to create pool for {db_url}: {e}")
            raise e
    
    conn = db_pools[db_url].getconn()
    return PooledConnectionWrapper(db_pools[db_url], conn)

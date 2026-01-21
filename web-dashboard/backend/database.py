import psycopg2
from psycopg2 import pool
from flask import g, current_app
from config import Config

# Global pool instance
_db_pool = None

def get_db_pool():
    global _db_pool
    if _db_pool is None:
        # Create a persistent pool when first needed
        _db_pool = psycopg2.pool.ThreadedConnectionPool(
            1, 20, dsn=Config.REMOTE_DB_URL
        )
    return _db_pool

def get_db_connection():
    if 'db_conn' not in g:
        db_pool = get_db_pool()
        g.db_conn = db_pool.getconn()
    return g.db_conn

def close_db_connection(e=None):
    db_conn = g.pop('db_conn', None)
    if db_conn is not None:
        _db_pool.putconn(db_conn)

def init_app(app):
    # Register teardown to ensure connections are returned to the pool
    app.teardown_appcontext(close_db_connection)

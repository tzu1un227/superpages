from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2

db_viewer_bp = Blueprint('db_viewer', __name__)

from db_utils import get_db_connection

@db_viewer_bp.route('/tables', methods=['GET'])
def list_tables():
    """List all available tables and views in the current database."""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Query information_schema to get tables and views
        # Excluding system schemas like pg_catalog and information_schema
        cur.execute("""
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        tables = cur.fetchall()
        
        cur.close()
        return jsonify({'tables': tables})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

@db_viewer_bp.route('/data', methods=['GET'])
def get_table_data():
    """Fetch data from a specific table with chunking and optional search."""
    table_name = request.args.get('table')
    limit = int(request.args.get('limit', 300))
    offset = int(request.args.get('offset', 0))
    search = request.args.get('search', '').strip()

    if not table_name:
        return jsonify({'error': 'Table name is required'}), 400

    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Basic validation of table name to prevent SQL Injection
        # Check if table exists in public schema
        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s AND table_schema = 'public'", (table_name,))
        if not cur.fetchone():
            cur.close()
            return jsonify({'error': f"Table '{table_name}' not found or inaccessible"}), 404

        # Building search query if search term provided
        search_query = ""
        params = [limit, offset]
        
        if search:
            # We fetch column names to perform a basic ILIKE search across text columns
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s AND data_type IN ('text', 'character varying')
            """, (table_name,))
            text_columns = [col['column_name'] for col in cur.fetchall()]
            
            if text_columns:
                search_params = [f"%{search}%"] * len(text_columns)
                conditions = [f"\"{col}\" ILIKE %s" for col in text_columns]
                search_query = "WHERE " + " OR ".join(conditions)
                params = search_params + params
            else:
                # If no text columns, we can't search easily this way
                # Maybe just return all or try to match first column
                pass

        # Execute data fetch
        query = f"SELECT * FROM \"{table_name}\" {search_query} LIMIT %s OFFSET %s"
        cur.execute(query, params)
        rows = cur.fetchall()
        
        # Get total count for pagination/chunking info
        cur.execute(f"SELECT COUNT(*) FROM \"{table_name}\" {search_query}", params[:-2] if search else [])
        total_count = cur.fetchone()['count']

        cur.close()
        
        return jsonify({
            'data': rows,
            'total': total_count,
            'limit': limit,
            'offset': offset
        })
    except Exception as e:
        import traceback
        print(f"DB Viewer Error: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500
    finally:
        if conn: conn.close()

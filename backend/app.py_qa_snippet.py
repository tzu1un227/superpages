
@app.route('/api/qa-bank', methods=['POST'])
def create_qa_entry():
    try:
        data = request.json
        if not data or 'tag' not in data or 'msg_rpy' not in data:
             return jsonify({"error": "Missing tag or msg_rpy"}), 400
        
        tag = data['tag']
        msg_rpy = data['msg_rpy'] # Expects list of dicts or list of strings?
        # Typically frontend sends list of objects.
        # We store as JSON string? 
        # Check dbModel logic, usually stores as JSON.
        
        import json
        msg_rpy_json = json.dumps(msg_rpy) 
        # But wait, original code might store logic differently.
        # Let's assume standard JSON storage.
        
        app_id = get_current_app_id()
        table_name = f"QA_bank:{app_id}"
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if table exists? Assuming it does.
        # UPSERT
        # Check if exists
        cur.execute(f'SELECT 1 FROM "{table_name}" WHERE tag = %s', (tag,))
        if cur.fetchone():
            sql = f'UPDATE "{table_name}" SET msg_rpy = %s WHERE tag = %s'
            cur.execute(sql, (msg_rpy_json, tag))
        else:
            sql = f'INSERT INTO "{table_name}" (tag, msg_rpy) VALUES (%s, %s)'
            cur.execute(sql, (tag, msg_rpy_json))
            
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/qa-bank/<string:tag>', methods=['GET'])
def get_qa_entry(tag):
    try:
        app_id = get_current_app_id()
        table_name = f"QA_bank:{app_id}"
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor) # Use DictCursor
        
        cur.execute(f'SELECT msg_rpy FROM "{table_name}" WHERE tag = %s', (tag,))
        row = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if row:
            # Parse msg_rpy if it's string
            ms = row['msg_rpy']
            # If stored as JSON string in JSONB column or Text column? usually Text in Postgres for this app
            try:
                import json
                if isinstance(ms, str):
                    ms = json.loads(ms)
            except:
                pass
            return jsonify({"tag": tag, "msg_rpy": ms})
        else:
            return jsonify({"error": "Not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

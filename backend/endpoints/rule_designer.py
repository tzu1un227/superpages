from flask import Blueprint, request, jsonify, g
from psycopg2.extras import RealDictCursor
import psycopg2
import json

rule_designer_bp = Blueprint('rule_designer', __name__)

def get_db_connection():
    if hasattr(g, 'current_db_url') and g.current_db_url:
        return psycopg2.connect(g.current_db_url)
    raise Exception("No OA DB context found. Please provide X-OA-ID header.")

def get_app_id():
    if hasattr(g, 'current_app_name') and g.current_app_name:
        return g.current_app_name
    if hasattr(g, 'current_db_url') and g.current_db_url:
        path_part = g.current_db_url.split('/')[-1]
        return path_part.split('?')[0].strip()
    return '5013'

@rule_designer_bp.route('/rules', methods=['GET'])
def list_rules():
    """List rules from both Q_bank and QA_bank."""
    bank_type = request.args.get('type', 'q_bank') # 'q_bank' or 'qa_bank'
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        app_id = get_app_id()
        
        table_name = f"Q_bank:{app_id}" if bank_type == 'q_bank' else f"QA_bank:{app_id}"
        
        # Check if table exists
        cur.execute("SELECT 1 FROM information_schema.tables WHERE table_name = %s", (table_name,))
        if not cur.fetchone():
            return jsonify({'rules': []})
            
        cur.execute(f'SELECT * FROM "{table_name}" ORDER BY id ASC')
        rules = cur.fetchall()
        
        cur.close()
        conn.close()
        return jsonify({'rules': rules})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@rule_designer_bp.route('/rules', methods=['POST'])
def create_rule():
    data = request.json
    bank_type = data.get('bank_type', 'q_bank')
    rule_data = data.get('rule')
    
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}" if bank_type == 'q_bank' else f"QA_bank:{app_id}"
        
        fields = []
        placeholders = []
        values = []
        
        # Mapping frontend rule object to DB columns
        for key, value in rule_data.items():
            if key == 'id': continue # Let DB handle ID or it's an update
            fields.append(f"\"{key}\"")
            
            # Special handling for arrays and JSON
            if isinstance(value, list):
                if key == 'msg_rpy':
                    placeholders.append("%s::json[]")
                    values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                else:
                    placeholders.append("%s")
                    values.append(value)
            else:
                placeholders.append("%s")
                values.append(value)
        
        sql = f"INSERT INTO \"{table_name}\" ({', '.join(fields)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        cur.execute(sql, values)
        new_id = cur.fetchone()[0]
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'status': 'success', 'id': new_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@rule_designer_bp.route('/rules/<int:rule_id>', methods=['PUT', 'POST']) # POST for compatibility with some clients
def update_rule(rule_id):
    data = request.json
    bank_type = data.get('bank_type', 'q_bank')
    rule_data = data.get('rule')
    
    if not rule_data:
        return jsonify({'error': 'Rule data is required'}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}" if bank_type == 'q_bank' else f"QA_bank:{app_id}"
        
        updates = []
        values = []
        
        for key, value in rule_data.items():
            if key == 'id': continue
            
            if isinstance(value, list):
                if key == 'msg_rpy':
                    updates.append(f"\"{key}\" = %s::json[]")
                    values.append([json.dumps(m, ensure_ascii=False) if not isinstance(m, str) else m for m in value])
                else:
                    updates.append(f"\"{key}\" = %s")
                    values.append(value)
            else:
                updates.append(f"\"{key}\" = %s")
                values.append(value)
        
        values.append(rule_id)
        sql = f"UPDATE \"{table_name}\" SET {', '.join(updates)} WHERE id = %s"
        cur.execute(sql, values)
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@rule_designer_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    bank_type = request.args.get('type', 'q_bank')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        app_id = get_app_id()
        table_name = f"Q_bank:{app_id}" if bank_type == 'q_bank' else f"QA_bank:{app_id}"
        
        cur.execute(f'DELETE FROM "{table_name}" WHERE id = %s', (rule_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

from flask import Blueprint, request, jsonify, g
from models import db, Broadcast, OAConfig
from auth import token_required
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import json

broadcast_bp = Blueprint('broadcast', __name__)

def get_db_connection(db_url):
    return psycopg2.connect(db_url)

def get_logical_app_id(oa):
    if oa.other_settings and 'app_name' in oa.other_settings:
        if oa.other_settings['app_name']:
            return str(oa.other_settings['app_name'])
    return oa.db_url.split('/')[-1].split('?')[0].strip()

@broadcast_bp.route('/audience-count', methods=['POST'])
@token_required
def get_audience_count():
    data = request.json
    target_type = data.get('target_type', 'all')
    target_value = data.get('target_value', '')
    
    oa_id = g.current_oa_id
    oa = OAConfig.query.get(oa_id)
    if not oa or not oa.db_url:
        return jsonify({'error': 'OA configuration error'}), 400
    
    try:
        conn = get_db_connection(oa.db_url)
        cur = conn.cursor()
        
        # Get total followers (friends)
        # Assuming app_id can be extracted from db_url or we need another way to get it
        # Based on app.py, get_current_app_id() returns the DB name.
        app_id = get_logical_app_id(oa)
        
        # Count target users
        count = 0
        if target_type == 'all':
            cur.execute(f'SELECT count(*) FROM "Private_var:{app_id}" WHERE name = \'name\'')
            count = cur.fetchone()[0]
        elif target_type == 'tag':
            # Tags are stored as JSON strings in Private_var:app_id WHERE name = 'tag'
            # We use LIKE for simplicity, but a more robust JSON check would be better
            cur.execute(f'SELECT count(*) FROM "Private_var:{app_id}" WHERE name = \'tag\' AND value LIKE %s', (f'%{target_value}%',))
            count = cur.fetchone()[0]
        elif target_type == 'ids':
            ids = [i.strip() for i in target_value.split(',') if i.strip()]
            count = len(ids)
            
        # Get total users (friends count from person_table or similar)
        # Let's use Private_var:name count as base for 'friend total'
        cur.execute(f'SELECT count(*) FROM "Private_var:{app_id}" WHERE name = \'name\'')
        total = cur.fetchone()[0]
        
        cur.close()
        conn.close()
        
        return jsonify({
            'count': count,
            'total': total,
            'ratio': round(count / total * 100, 2) if total > 0 else 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@broadcast_bp.route('/', methods=['GET'])
@token_required
def list_broadcasts():
    oa_id = g.current_oa_id
    status = request.args.get('status')
    
    query = Broadcast.query.filter_by(oa_id=oa_id)
    if status and status != 'all':
        query = query.filter_by(status=status)
        
    broadcasts = query.order_by(Broadcast.created_at.desc()).all()
    
    # --- Status Reconciliation ---
    # Since the bot engine deletes cron_table entries after execution, 
    # we check if scheduled broadcasts have passed their time and are gone from cron_table.
    now = datetime.now()
    oa = OAConfig.query.get(oa_id)
    if oa and oa.db_url:
        try:
            # We only check broadcasts that are 'scheduled' and whose time has passed
            to_check = [b for b in broadcasts if b.status == 'scheduled' and b.scheduled_at and b.scheduled_at <= now]
            if to_check:
                conn = get_db_connection(oa.db_url)
                cur = conn.cursor()
                updated_any = False
                for bc in to_check:
                    # The bot engine uses "QA|{tag}" for broadcast tasks
                    cur.execute("SELECT 1 FROM cron_table WHERE message_content = %s LIMIT 1", (f"QA|{bc.message_tag}",))
                    if not cur.fetchone():
                        bc.status = 'sent'
                        updated_any = True
                cur.close()
                conn.close()
                if updated_any:
                    db.session.commit()
        except Exception as e:
            print(f"Reconciliation error: {e}")
    # --- End Status Reconciliation ---
    
    return jsonify({
        'broadcasts': [{
            'id': b.id,
            'name': b.name,
            'target_type': b.target_type,
            'target_value': b.target_value,
            'message_tag': b.message_tag,
            'send_type': b.send_type,
            'status': b.status,
            'scheduled_at': b.scheduled_at.isoformat() if b.scheduled_at else None,
            'created_at': b.created_at.isoformat()
        } for b in broadcasts]
    })

@broadcast_bp.route('/', methods=['POST'])
@token_required
def create_broadcast():
    data = request.json
    oa_id = g.current_oa_id
    
    new_bc = Broadcast(
        oa_id=g.current_oa_id,
        name=data.get('name', '未命名廣播'),
        target_type=data.get('target_type', 'all'),
        target_value=data.get('target_value', ''),
        message_tag=data.get('message_tag'),
        send_type=data.get('send_type', 'immediate'),
        status=data.get('status', 'draft'),
        scheduled_at=datetime.fromisoformat(data['scheduled_at']) if data.get('scheduled_at') else None
    )
    
    # If status is scheduled or sent, we should have a message_tag
    if data.get('message_tag'):
        new_bc.message_tag = data['message_tag']
        
    db.session.add(new_bc)
    db.session.commit()
    
    # If immediately sending or scheduling, handle cron_table insertion
    if new_bc.status != 'draft':
        # This will be handled in a separate 'execute' step or integrated here
        pass
        
    return jsonify({'id': new_bc.id, 'status': 'success'})

@broadcast_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_broadcast(id):
    bc = Broadcast.query.get_or_404(id)
    if bc.status == 'sent':
        return jsonify({'error': 'Cannot update sent broadcast'}), 400
        
    data = request.json
    bc.name = data.get('name', bc.name)
    bc.target_type = data.get('target_type', bc.target_type)
    bc.target_value = data.get('target_value', bc.target_value)
    bc.send_type = data.get('send_type', bc.send_type)
    bc.status = data.get('status', bc.status)
    if data.get('scheduled_at'):
        bc.scheduled_at = datetime.fromisoformat(data['scheduled_at'])
    if data.get('message_tag'):
        bc.message_tag = data['message_tag']
        
    db.session.commit()
    return jsonify({'status': 'success'})

@broadcast_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_broadcast(id):
    bc = Broadcast.query.get_or_404(id)
    
    # 1. If scheduled, remove from cron_table
    if bc.status == 'scheduled' or bc.status == 'active':
        oa = OAConfig.query.get(bc.oa_id)
        if oa and oa.db_url:
            try:
                conn = get_db_connection(oa.db_url)
                cur = conn.cursor()
                msg_content = f"QA|{bc.message_tag}"
                cur.execute("DELETE FROM cron_table WHERE message_content = %s", (msg_content,))
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e:
                print(f"Error deleting from cron_table: {e}")

    db.session.delete(bc)
    db.session.commit()
    return jsonify({'status': 'success'})

@broadcast_bp.route('/<int:id>/execute', methods=['POST'])
@token_required
def execute_broadcast(id):
    bc = Broadcast.query.get_or_404(id)
    if bc.status == 'sent':
        return jsonify({'error': 'Broadcast already sent'}), 400
        
    oa = OAConfig.query.get(bc.oa_id)
    if not oa or not oa.db_url:
        return jsonify({'error': 'OA configuration error (missing db_url)'}), 400
        
    app_id = get_logical_app_id(oa)
    
    try:
        conn = get_db_connection(oa.db_url)
        cur = conn.cursor()
        
        # 1. Get targets
        user_ids = []
        if bc.target_type == 'all':
            cur.execute(f'SELECT user_id FROM "Private_var:{app_id}" WHERE name = \'name\'')
            user_ids = [r[0] for r in cur.fetchall()]
        elif bc.target_type == 'tag':
            cur.execute(f'SELECT user_id FROM "Private_var:{app_id}" WHERE name = \'tag\' AND value LIKE %s', (f'%{bc.target_value}%',))
            user_ids = [r[0] for r in cur.fetchall()]
        elif bc.target_type == 'ids':
            user_ids = [i.strip() for i in bc.target_value.split(',') if i.strip()]
            
        # 2. Insert into cron_table
        # Use UTC time for push_time since the RDS database stores/compares with UTC NOW()
        push_time = bc.scheduled_at if bc.scheduled_at else datetime.now(timezone.utc).replace(tzinfo=None)
        msg_content = f"QA|{bc.message_tag}"
        
        for uid in user_ids:
            cur.execute(
                "INSERT INTO cron_table (user_id, message_content, push_time, status) VALUES (%s, %s, %s, 'active')",
                (uid, msg_content, push_time)
            )
            
        conn.commit()
        cur.close()
        conn.close()
        
        bc.status = 'scheduled' if bc.scheduled_at and bc.scheduled_at > datetime.now() else 'sent'
        db.session.commit()
        
        return jsonify({'status': 'success', 'targets': len(user_ids)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

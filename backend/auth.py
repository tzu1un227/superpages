import os
import jwt
import datetime
from functools import wraps
from flask import request, jsonify, g
from config import Config
from models import User

# Secret key should typically come from Config, fallback for dev
SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev_secret_key'

def generate_token(user):
    payload = {
        'sub': str(user.id),
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = User.query.get(data['sub'])
            if not current_user:
                return jsonify({'message': 'User not found'}), 401
            g.current_user = current_user
            
            # Check for OA Permission if an OA Context is loaded
            if hasattr(g, 'current_oa_id') and g.current_oa_id:
                # Admins have access to everything
                if current_user.role != 'admin':
                    allowed_ids = current_user.allowed_oa_configs or []
                    # Ensure integer comparison
                    try:
                        oa_id_int = int(g.current_oa_id)
                        if oa_id_int not in allowed_ids:
                             return jsonify({'message': f'You are not authorized to access OA {g.current_oa_id}'}), 403
                    except ValueError:
                         return jsonify({'message': 'Invalid OA ID format'}), 400

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'message': f'Invalid token: {str(e)}'}), 401
        
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if g.current_user.role != 'admin':
            return jsonify({'message': 'Admin privilege required'}), 403
        return f(*args, **kwargs)
    return decorated

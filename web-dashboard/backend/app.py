from flask import Flask, jsonify, request, g
from flask_cors import CORS
from config import Config
import database
from db_utils import get_events_count_by_category_and_tag, get_keyword_ranking
# Import local DB models
from models import db, User, Page, OAConfig
from auth import generate_token, token_required, admin_required
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from datetime import datetime, timedelta

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize SQLAlchemy with the app
    db.init_app(app)
    
    CORS(app, origins=["https://irl-svr.ee.yzu.edu.tw:5014", "http://localhost:3000"])  # 允許目前的線上網址與在地開發環境

    # Register Admin Blueprint under /api/admin
    from endpoints.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')

    @app.route('/api/auth/google-login', methods=['POST'])
    def google_login():
        try:
            data = request.get_json()
            google_token = data.get('token')
            
            if not google_token:
                return jsonify({'message': 'No token provided'}), 400
            
            # Verify Google token
            # CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')  # Using allow_all for dev if needed, or proper verify
            # For strict verification, use the actual Client ID from frontend
            
            try:
                # Assuming CLIENT_ID is meant to be verified. For now we trust the token content if google validates it
                # Or use a simplified verify for dev if credentials aren't set up in env
                idinfo = id_token.verify_oauth2_token(google_token, google_requests.Request())
            except ValueError as e:
                print(f"Token verification error: {e}")
                return jsonify({'message': f'Invalid Google token: {str(e)}'}), 400
            
            email = idinfo['email']
            user = User.query.filter_by(email=email).first()
            
            if not user:
                return jsonify({'message': 'User not authorized'}), 401
            
            # Update user name from Google info if not set or changed
            google_name = idinfo.get('name')
            if google_name and user.name != google_name:
                user.name = google_name
                db.session.commit()
            
            token = generate_token(user)
            
            return jsonify({
                'token': token,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'role': user.role,
                    'allowed_oa_configs': user.allowed_oa_configs
                }
            })
        except Exception as e:
            print(e)
            return jsonify({'message': 'Login failed', 'error': str(e)}), 500

    @app.route('/api/my_oas', methods=['GET'])
    @token_required
    def get_my_oas():
        user = g.current_user
        try:
            if user.role == 'admin':
                # Admins see all OAs
                configs = OAConfig.query.all()
            else:
                # Regular users see allowed OAs
                allowed_ids = user.allowed_oa_configs or []
                configs = OAConfig.query.filter(OAConfig.id.in_(allowed_ids)).all()
            
            oa_list = [{'id': c.id, 'name': c.oa_name, 'oa_name': c.oa_name, 'page_id': c.page_id} for c in configs]
            return jsonify(oa_list)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/test_db')
    def test_db():
        conn = None
        try:
            # Note: get_db_connection now manages the connection lifecycle via g
            conn = database.get_db_connection()
            cur = conn.cursor()
            cur.execute('SELECT version();')
            db_version = cur.fetchone()
            cur.close()
            return jsonify({'status': 'success', 'db_version': db_version})
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500
        # No finally block needed here, as the teardown context will handle it.

    # FR-002: 用戶人數和加入趨勢視覺化
    @app.route('/api/dashboard/user_trend', methods=['GET'])
    @token_required
    def get_user_trend():
        period = request.args.get('period', '週')  # 日/週/月
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        data_type = request.args.get('data_type', 'Message')  # 'Message', 'Follow', or 'user'
        account_id = request.args.get('account')

        db_url = None
        app_name = None
        if account_id:
            try:
                account_id = int(account_id)
                user = g.current_user
                
                # Check permission
                if user.role != 'admin':
                    allowed = user.allowed_oa_configs or []
                    if account_id not in allowed:
                        return jsonify({'message': 'Access to this account is not authorized'}), 403
                
                # Get DB URL
                config = OAConfig.query.get(account_id)
                if config:
                    db_url = config.db_url
                    if config.other_settings and config.other_settings.get('app_name'):
                        app_name = str(config.other_settings.get('app_name'))
                else:
                    return jsonify({'message': 'OA Config not found'}), 404
            except ValueError:
                return jsonify({'message': 'Invalid account ID'}), 400

        if not start_date:
            # Default to 7 weeks ago if not provided
            start_date = (datetime.now() - timedelta(weeks=7)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        start_time = f"{start_date} 00:00:00+08"
        end_time = f"{end_date} 23:59:59+08"
        
        # In the get_user_trend function
        # In the get_user_trend function
        category = data_type
        group_unit = period
        
        
        try:
            data = get_events_count_by_category_and_tag(
                start_time,
                end_time,
                category,
                group_unit,
                db_url=db_url,
                app_name=app_name
            )
            return jsonify(data)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # FR-003: 用戶回應趨勢視覺化
    @app.route('/api/dashboard/responses', methods=['GET'])
    @token_required
    def get_responses_dashboard():
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        tag = request.args.get('tag', '')
        limit = request.args.get('limit', 50, type=int)
        account_id = request.args.get('account')

        db_url = None
        app_name = None
        if account_id:
            try:
                account_id = int(account_id)
                user = g.current_user
                
                # Check permission
                if user.role != 'admin':
                    allowed = user.allowed_oa_configs or []
                    if account_id not in allowed:
                        return jsonify({'message': 'Access to this account is not authorized'}), 403
                
                # Get DB URL
                config = OAConfig.query.get(account_id)
                if config:
                    db_url = config.db_url
                    if config.other_settings and config.other_settings.get('app_name'):
                        app_name = str(config.other_settings.get('app_name'))
                else:
                    return jsonify({'message': 'OA Config not found'}), 404
            except ValueError:
                return jsonify({'message': 'Invalid account ID'}), 400
        
        if not start_date:
            # 預設七週前
            start_date = (datetime.now() - timedelta(weeks=7)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        start_time = f"{start_date} 00:00:00+08"
        end_time = f"{end_date} 23:59:59+08"
        
        try:
            # Note: get_db_connection now manages the connection lifecycle via g
            data = get_keyword_ranking(start_time, end_time, tag, limit, db_url=db_url, app_name=app_name)
            
            return jsonify({
                'data': data
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app

# Expose app for WSGI/Gunicorn
app = create_app()

# For development only
if __name__ == '__main__':
    app.run(debug=True)

# Trigger reload
# Reload

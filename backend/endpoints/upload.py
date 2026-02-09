from flask import Blueprint, request, jsonify, g
import requests
import os
import base64
from datetime import datetime
from auth import token_required

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/github', methods=['POST'])
@token_required
def upload_to_github():
    # Retrieve settings from current OA context
    github_config = {}
    if hasattr(g, 'current_oa_config') and g.current_oa_config.other_settings:
        github_config = g.current_oa_config.other_settings.get('github_config', {})

    token = github_config.get('token') or os.environ.get('GITHUB_TOKEN')
    repo = github_config.get('repo') or os.environ.get('GITHUB_REPO')
    branch = github_config.get('branch') or os.environ.get('GITHUB_BRANCH', 'main')
    path = github_config.get('path') or os.environ.get('GITHUB_PATH', 'assets/images/')

    if not token or not repo:
        return jsonify({'message': 'GitHub configuration is missing (Token or Repo)'}), 500

    if 'file' not in request.files:
        return jsonify({'message': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400

    try:
        # Read file and encode to base64
        file_content = file.read()
        encoded_content = base64.b64encode(file_content).decode('utf-8')

        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        
        # Ensure path ends with /
        if not path.endswith('/'):
            path += '/'
        
        url = f"https://api.github.com/repos/{repo}/contents/{path}{filename}"
        
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        payload = {
            "message": f"Upload image: {filename}",
            "content": encoded_content,
            "branch": branch
        }
        
        response = requests.put(url, headers=headers, json=payload)
        
        if response.status_code in [201, 200]:
            data = response.json()
            # raw_url = data['content']['download_url']
            # Convert to jsDelivr URL for better LINE compatibility
            # Format: https://cdn.jsdelivr.net/gh/user/repo@branch/path/file
            
            # Remove leading slash from path if present to avoid double slashes
            clean_path = path.lstrip('/')
            
            # URL encode the filename to handle spaces and special characters
            from urllib.parse import quote
            encoded_filename = quote(filename)
            encoded_path = quote(clean_path)
            
            # Construct jsDelivr URL with encoded components
            # Note: jsDelivr expects the path to be encoded if it contains special chars
            cdn_url = f"https://cdn.jsdelivr.net/gh/{repo}@{branch}/{encoded_path}{encoded_filename}"
            
            return jsonify({
                'message': 'Upload successful',
                'url': cdn_url,
                'path': data['content']['path']
            })
        else:
            return jsonify({
                'message': 'GitHub upload failed',
                'error': response.json()
            }), response.status_code

    except Exception as e:
        return jsonify({'message': 'Internal server error', 'error': str(e)}), 500

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
from decimal import Decimal

app = Flask(__name__)
CORS(app)

import json

def json_response(data):
    return app.response_class(
        json.dumps(data, default=lambda x: float(x) if isinstance(x, Decimal) else (x.isoformat() if isinstance(x, (datetime, date)) else str(x))),
        mimetype='application/json'
    )

# Database configuration
DB_CONFIG = {
    "host": "140.138.176.197",
    "port": "5432",
    "database": "5013",
    "user": "postgres",
    "password": "0000"
}

def get_db_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    return conn

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    # Simple auth for prototype, can be enhanced
    if username == "admin" and password == "admin":
        return jsonify({"status": "success", "user": {"id": 1, "username": "admin"}})
    return jsonify({"status": "error", "message": "Invalid credentials"}), 401

# Projects CRUD
@app.route('/api/projects', methods=['GET'])
def get_projects():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM projects ORDER BY project_id")
        projects = cur.fetchall()
        cur.close()
        conn.close()
        return json_response(projects)
    except Exception as e:
        print(f"Error in get_projects: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    try:
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        
        if end_date <= start_date:
            return jsonify({"status": "error", "message": "結束時間必須大於開始時間"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO projects (project_name, start_date, end_date, is_enabled) VALUES (%s, %s, %s, %s) RETURNING project_id",
            (data['project_name'], data['start_date'], data['end_date'], data['is_enabled'])
        )
        project_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "project_id": project_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['PUT'])
def update_project(id):
    data = request.json
    try:
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        
        if end_date <= start_date:
            return jsonify({"status": "error", "message": "結束時間必須大於開始時間"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE projects SET project_name=%s, start_date=%s, end_date=%s, is_enabled=%s WHERE project_id=%s",
            (data['project_name'], data['start_date'], data['end_date'], data['is_enabled'], id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/projects/<int:id>', methods=['DELETE'])
def delete_project(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM projects WHERE project_id=%s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Schedules CRUD
@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    try:
        project_id = request.args.get('project_id')
        print(f"Fetching schedules for project_id: {project_id}")
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        if project_id and project_id != "":
            cur.execute("SELECT * FROM project_schedules WHERE project_id = %s ORDER BY schedule_id", (project_id,))
        else:
            cur.execute("SELECT * FROM project_schedules ORDER BY schedule_id")
        schedules = cur.fetchall()
        cur.close()
        conn.close()
        print(f"Successfully fetched {len(schedules)} schedules")
        return json_response(schedules)
    except Exception as e:
        print(f"Error in get_schedules: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/schedules', methods=['POST'])
def create_schedule():
    data = request.json
    try:
        if float(data['interval_hours']) <= 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於 0"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO project_schedules (project_id, step_id, interval_hours, message_content) VALUES (%s, %s, %s, %s) RETURNING schedule_id",
            (data['project_id'], data['step_id'], data['interval_hours'], data['message_content'])
        )
        schedule_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "schedule_id": schedule_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/<int:id>', methods=['PUT'])
def update_schedule(id):
    data = request.json
    try:
        if float(data['interval_hours']) <= 0:
            return jsonify({"status": "error", "message": "間隔時間必須大於 0"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE project_schedules SET project_id=%s, step_id=%s, interval_hours=%s, message_content=%s WHERE schedule_id=%s",
            (data['project_id'], data['step_id'], data['interval_hours'], data['message_content'], id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/schedules/<int:id>', methods=['DELETE'])
def delete_schedule(id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM project_schedules WHERE schedule_id=%s", (id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

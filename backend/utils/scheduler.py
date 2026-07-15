import time
import threading
from psycopg2.extras import RealDictCursor

def project_stats_processor(app):
    """
    Background thread to monitor history and update project-specific statistics.
    """
    from db_utils import get_db_connection, get_main_db_connection
    from models import OAConfig
    from app import increment_project_stat

    while True:
        try:
            with app.app_context():
                # Get all OAs to poll their history
                oas = OAConfig.query.all()
                for oa in oas:
                    oa_id = oa.id
                    db_url = oa.db_url
                    if db_url:
                        conn_oa = None
                        conn_rds = None
                        try:
                            # 1. Access OA Database for History and Stats
                            # Use pooling
                            conn_oa = get_db_connection(db_url)
                            cur_oa = conn_oa.cursor(cursor_factory=RealDictCursor)
                            
                            # Determine logical_app_id for OA DB tables (history, Global_var)
                            logical_app_id = str(oa_id)
                            if oa.other_settings and 'app_name' in oa.other_settings:
                                if oa.other_settings['app_name']:
                                    logical_app_id = str(oa.other_settings['app_name'])
                            
                            # 2. Access RDS Main Database for Business Tables (projects, schedules, etc.)
                            conn_rds = get_main_db_connection()
                            cur_rds = conn_rds.cursor(cursor_factory=RealDictCursor)
                            
                            def get_t(base):
                                # Helper for this loop
                                return f'"{base}:{logical_app_id}"'

                            # Get last processed time from Global_var (OA DB)
                            g_var_table = f"Global_var:{logical_app_id}"
                            
                            # Ensure table exists in OA DB
                            cur_oa.execute(
                                "SELECT 1 FROM information_schema.tables WHERE table_name = %s",
                                (g_var_table,)
                            )
                            if not cur_oa.fetchone():
                                cur_oa.execute(f"""
                                    CREATE TABLE "{g_var_table}" (
                                        name VARCHAR(255) PRIMARY KEY,
                                        value TEXT
                                    )
                                """)

                            cur_oa.execute(f"SELECT value FROM \"{g_var_table}\" WHERE name = 'last_stats_process_time'")
                            row = cur_oa.fetchone()
                            last_time = row['value'] if row else '2000-01-01 00:00:00'
                            
                            # Fetch new history entries (OA DB)
                            history_table = f"history:{logical_app_id}"
                            cur_oa.execute(f"""
                                SELECT * FROM "{history_table}" 
                                WHERE timestamp > %s 
                                AND ((category = 'Message' OR category = 'Sensor') AND content LIKE '%%QA|cron_%%')
                                ORDER BY timestamp ASC
                            """, (last_time,))
                            entries = cur_oa.fetchall()
                            
                            max_timestamp = last_time
                            
                            for entry in entries:
                                max_timestamp = entry['timestamp']
                                content = entry['content']
                                try:
                                    parts = content.split('_')
                                    if len(parts) >= 3:
                                        pj_id = int(parts[1])
                                        step_id = int(parts[2])
                                        
                                        increment_project_stat(pj_id, 'ms', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                        increment_project_stat(pj_id, 'mss', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                        
                                        # Query RDS for business data
                                        t_schedules = get_t('project_schedules')
                                        cur_rds.execute(f"SELECT MAX(step_id) FROM {t_schedules} WHERE project_id = %s", (pj_id,))
                                        m_row = cur_rds.fetchone()
                                        if m_row and m_row['max'] == step_id:
                                            increment_project_stat(pj_id, 'cc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                            increment_project_stat(pj_id, 'tcc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                            
                                            t_projects = get_t('projects')
                                            cur_rds.execute(f"SELECT is_recurring FROM {t_projects} WHERE project_id = %s", (pj_id,))
                                            p_row = cur_rds.fetchone()
                                            is_recurring = p_row['is_recurring'] if p_row else False
                                            
                                            user_id = entry.get('user_id')
                                            if user_id:
                                                ups_status = 'active'
                                                t_cron = get_t('cron_table')
                                                if is_recurring:
                                                    cur_rds.execute(f"UPDATE {t_cron} SET step_id = 0, status = 'active' WHERE project_id = %s AND user_id = %s", (pj_id, user_id))
                                                    increment_project_stat(pj_id, 'ttc', oa_id, entry['timestamp'].strftime('%Y-%m-%d'))
                                                    ups_status = 'active'
                                                else:
                                                    cur_rds.execute(f"UPDATE {t_cron} SET status = 'completed' WHERE project_id = %s AND user_id = %s", (pj_id, user_id))
                                                    ups_status = 'completed'
                                                
                                                t_ups = get_t('user_project_status')
                                                try:
                                                    cur_rds.execute(f"""
                                                        INSERT INTO {t_ups} (user_id, project_id, status, updated_at) 
                                                        VALUES (%s, %s, %s, NOW())
                                                        ON CONFLICT (user_id, project_id) 
                                                        DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
                                                    """, (user_id, pj_id, ups_status))
                                                except Exception as upse:
                                                    print(f"Error syncing user_project_status: {upse}")
                                                    conn_rds.rollback()
                                            
                                    conn_rds.commit()
                                except Exception as pe:
                                    print(f"Error parsing history entry for stats: {pe}")
                                    if conn_rds: conn_rds.rollback()
                                    if conn_oa: conn_oa.rollback()
                            
                            # Update last processed time (OA DB)
                            cur_oa.execute(f"UPDATE \"{g_var_table}\" SET value = %s WHERE name = 'last_stats_process_time'", (str(max_timestamp),))
                            if cur_oa.rowcount == 0:
                                cur_oa.execute(f"INSERT INTO \"{g_var_table}\" (name, value) VALUES ('last_stats_process_time', %s)", (str(max_timestamp),))
                            
                            conn_oa.commit()
                        except Exception as db_err:
                            print(f"Error processing stats for app {logical_app_id}: {db_err}")
                            if conn_oa: conn_oa.rollback()
                            if conn_rds: conn_rds.rollback()
                        finally:
                            if 'cur_oa' in locals() and cur_oa: cur_oa.close()
                            if conn_oa: conn_oa.close()
                            if 'cur_rds' in locals() and cur_rds: cur_rds.close()
                            if conn_rds: conn_rds.close()
                        
        except Exception as e:
            print(f"Error in project_stats_processor: {e}")
        
        time.sleep(30) # Check every 30 seconds

def rich_menu_scheduler_processor(app):
    """
    Background thread to execute project steps based on rich menu schedules.
    Calls check_and_apply_scheduled_rich_menus for each active OA.
    """
    from endpoints.richmenu import check_and_apply_scheduled_rich_menus
    while True:
        try:
            with app.app_context():
                from models import OAConfig
                all_oas = OAConfig.query.all()
                for oa in all_oas:
                    if not oa.other_settings: continue
                    app_name = oa.other_settings.get('app_name')
                    if not app_name: continue
                    
                    check_and_apply_scheduled_rich_menus(app_name)
        except Exception as e:
            print(f"[RichMenuScheduler] Outer error: {e}")
        time.sleep(60)

def cron_table_checker(app):
    """
    Background thread to send check_cron_table websocket event every minute
    to all OAs with socket_url configured.
    """
    from models import OAConfig
    from utils.socket_utils import send_socket_event

    while True:
        try:
            with app.app_context():
                oas = OAConfig.query.all()
                unique_urls = set()
                for oa in oas:
                    if oa.other_settings and oa.other_settings.get('socket_url'):
                        unique_urls.add(oa.other_settings.get('socket_url'))
                
                for socket_url in unique_urls:
                    data = {
                        'user': 'yzuadmin',
                        'type': 'Sensor',
                        'message': 'check_cron_table',
                        'target_ws_url': socket_url
                    }
                    try:
                        send_socket_event(data, namespace='/websoc')
                        # print(f"[CRON TIMER] Sent check_cron_table to {socket_url}")
                    except Exception as inner_e:
                        print(f"[CRON TIMER] Failed to send to {socket_url}: {inner_e}")
        except Exception as e:
            print(f"[CRON TIMER] Error in check loop: {e}")
        
        time.sleep(60)

import socket

_scheduler_lock_socket = None

def start_all_schedulers(app):
    """
    Starts all the background scheduler threads for the superpages application.
    """
    global _scheduler_lock_socket
    try:
        # 嘗試綁定本地 Port，只有第一個啟動的 Worker 能夠成功
        _scheduler_lock_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        _scheduler_lock_socket.bind(('127.0.0.1', 47200))
    except socket.error:
        print("[SCHEDULER] Already running in another worker. Skipping.")
        return

    threading.Thread(target=project_stats_processor, args=(app,), daemon=True).start()
    threading.Thread(target=rich_menu_scheduler_processor, args=(app,), daemon=True).start()
    threading.Thread(target=cron_table_checker, args=(app,), daemon=True).start()
    print("[SCHEDULER] All background schedulers started in this worker.")

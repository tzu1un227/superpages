import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

# DB URLs
SUPERPAGES_DB_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

STD_SUFFIX = "yzulabuse"
TARGET_SUFFIX = "5013"

def get_db_schema(db_url, suffix):
    """
    Connect to a DB and fetch table/view metadata, normalizing suffixes.
    Returns:
      tables: dict mapping base_name -> raw_table_name
      table_type: dict mapping base_name -> 'BASE TABLE' or 'VIEW'
      columns: dict mapping base_name -> list of dicts (column_name, data_type, udt_name, is_nullable, column_default)
    """
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch tables and views
    cur.execute("""
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    raw_tables = cur.fetchall()
    
    tables_map = {}
    table_type_map = {}
    
    for r in raw_tables:
        raw_name = r['table_name']
        t_type = r['table_type']
        
        # Check if suffixed (e.g. "Q_bank:yzulabuse" or "v_liff_questionnaire_results:yzulabuse")
        if f":{suffix}" in raw_name:
            base_name = raw_name.replace(f":{suffix}", "")
        elif f"_{suffix}" in raw_name:
            base_name = raw_name.replace(f"_{suffix}", "")
        else:
            base_name = raw_name
            
        tables_map[base_name] = raw_name
        table_type_map[base_name] = t_type
        
    # 2. Fetch columns
    cur.execute("""
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    raw_cols = cur.fetchall()
    
    columns_map = {}
    for c in raw_cols:
        raw_name = c['table_name']
        if f":{suffix}" in raw_name:
            base_name = raw_name.replace(f":{suffix}", "")
        elif f"_{suffix}" in raw_name:
            base_name = raw_name.replace(f"_{suffix}", "")
        else:
            base_name = raw_name
            
        if base_name not in columns_map:
            columns_map[base_name] = []
        columns_map[base_name].append(c)
        
    cur.close()
    conn.close()
    
    return tables_map, table_type_map, columns_map

def compare_schemas():
    print("=== [1] 開始載入 Superpages (標準標竿) 與 5013 Schema ===")
    std_tables, std_types, std_cols = get_db_schema(SUPERPAGES_DB_URL, STD_SUFFIX)
    tgt_tables, tgt_types, tgt_cols = get_db_schema(TARGET_5013_DB_URL, TARGET_SUFFIX)

    print(f"標準商案 (superpages/{STD_SUFFIX}) 表格/視圖總數: {len(std_tables)}")
    print(f"目標商案 (5013/{TARGET_SUFFIX}) 表格/視圖總數: {len(tgt_tables)}")

    std_base_set = set(std_tables.keys())
    tgt_base_set = set(tgt_tables.keys())

    missing_in_target = std_base_set - tgt_base_set
    extra_in_target = tgt_base_set - std_base_set
    common_tables = std_base_set & tgt_base_set

    print("\n--- [比對結果 SUMMARY] ---")
    print(f"1. 5013 缺少的表格/視圖 ({len(missing_in_target)} 個): {sorted(list(missing_in_target))}")
    print(f"2. 5013 多餘的表格/視圖 ({len(extra_in_target)} 個): {sorted(list(extra_in_target))}")

    # Column level comparison
    missing_columns = {} # base_name -> list of col_dicts
    extra_columns = {}   # base_name -> list of col_names

    for base in sorted(common_tables):
        std_col_dict = {c['column_name']: c for c in std_cols.get(base, [])}
        tgt_col_dict = {c['column_name']: c for c in tgt_cols.get(base, [])}

        std_col_set = set(std_col_dict.keys())
        tgt_col_set = set(tgt_col_dict.keys())

        missing_c = std_col_set - tgt_col_set
        extra_c = tgt_col_set - std_col_set

        if missing_c:
            missing_columns[base] = [std_col_dict[cn] for cn in missing_c]
        if extra_c:
            extra_columns[base] = list(extra_c)

    print(f"3. 共用表格中，5013 有缺少欄位的表格數: {len(missing_columns)}")
    for base, cols in missing_columns.items():
        c_names = [c['column_name'] for c in cols]
        print(f"   - {base} 缺少欄位: {c_names}")

    print(f"4. 共用表格中，5013 有多餘欄位的表格數: {len(extra_columns)}")
    for base, c_names in extra_columns.items():
        print(f"   - {base} 多餘欄位: {c_names}")

    return {
        'std_tables': std_tables,
        'std_types': std_types,
        'std_cols': std_cols,
        'tgt_tables': tgt_tables,
        'tgt_types': tgt_types,
        'tgt_cols': tgt_cols,
        'missing_tables': missing_in_target,
        'extra_tables': extra_in_target,
        'missing_columns': missing_columns,
        'extra_columns': extra_columns
    }

if __name__ == '__main__':
    compare_schemas()

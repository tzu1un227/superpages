import os
import sys
import json
import psycopg2
from psycopg2.extras import RealDictCursor

sys.stdout.reconfigure(encoding='utf-8')

SUPERPAGES_DB_URL = "postgresql://u96dp6sm9o9f9:p7ac2133ca353c2b313a9f40e8624cd3674aa088bc788dd3f6b45afd3a2439527@ec2-100-55-231-150.compute-1.amazonaws.com:5432/d5l2u0pogs9o2"
TARGET_5013_DB_URL = "postgresql://postgres:0000@140.138.176.197:5432/5013"

STD_SUFFIX = "yzulabuse"
TARGET_SUFFIX = "5013"

def get_suffix_schema(db_url, suffix):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Fetch tables/views containing suffix
    cur.execute("""
        SELECT table_name, table_type 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    all_tables = cur.fetchall()
    
    tables_map = {}
    table_type_map = {}
    
    for r in all_tables:
        raw_name = r['table_name']
        t_type = r['table_type']
        
        # Keep table if it is specific to suffix OR if it's a shared core table (like projects, OAConfig, users)
        if f":{suffix}" in raw_name or f"_{suffix}" in raw_name:
            base_name = raw_name.replace(f":{suffix}", "").replace(f"_{suffix}", "")
            tables_map[base_name] = raw_name
            table_type_map[base_name] = t_type
        elif ":" not in raw_name and not any(raw_name.endswith(f"_{s}") for s in ['01','02','03','04','05','bot','test','yzulabuse']):
            # Common core table (e.g. projects, project_schedules, OAConfig, qa_bank, Q_bank if un-suffixed)
            tables_map[raw_name] = raw_name
            table_type_map[raw_name] = t_type
            
    # 2. Fetch columns
    cur.execute("""
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    all_cols = cur.fetchall()
    
    columns_map = {}
    for c in all_cols:
        raw_name = c['table_name']
        base_name = None
        if f":{suffix}" in raw_name:
            base_name = raw_name.replace(f":{suffix}", "")
        elif f"_{suffix}" in raw_name:
            base_name = raw_name.replace(f"_{suffix}", "")
        elif raw_name in tables_map:
            base_name = raw_name
            
        if base_name and base_name in tables_map:
            if base_name not in columns_map:
                columns_map[base_name] = []
            columns_map[base_name].append(c)
            
    cur.close()
    conn.close()
    return tables_map, table_type_map, columns_map

def run_precision_check():
    std_tables, std_types, std_cols = get_suffix_schema(SUPERPAGES_DB_URL, STD_SUFFIX)
    tgt_tables, tgt_types, tgt_cols = get_suffix_schema(TARGET_5013_DB_URL, TARGET_SUFFIX)

    print(f"=== 精準比對結果: 標準商案 ({STD_SUFFIX}) vs 5013 ({TARGET_SUFFIX}) ===")
    
    std_bases = set(std_tables.keys())
    tgt_bases = set(tgt_tables.keys())

    missing_tables = std_bases - tgt_bases
    extra_tables = tgt_bases - std_bases
    common_tables = std_bases & tgt_bases

    print(f"\n[1] 5013 缺少的表格 / 視圖 ({len(missing_tables)} 個):")
    for b in sorted(list(missing_tables)):
        print(f"  - {b}:{TARGET_SUFFIX} (Type: {std_types[b]}, 標準樣板: {std_tables[b]})")

    print(f"\n[2] 5013 多餘的表格 / 視圖 ({len(extra_tables)} 個):")
    for b in sorted(list(extra_tables)):
        print(f"  - {tgt_tables[b]} (Type: {tgt_types[b]})")

    print(f"\n[3] 欄位層級差異比對 (共有 {len(common_tables)} 個共用基礎表):")
    missing_cols_dict = {}
    extra_cols_dict = {}

    for b in sorted(common_tables):
        s_cols = {c['column_name']: c for c in std_cols.get(b, [])}
        t_cols = {c['column_name']: c for c in tgt_cols.get(b, [])}

        missing_names = set(s_cols.keys()) - set(t_cols.keys())
        extra_names = set(t_cols.keys()) - set(s_cols.keys())

        if missing_names:
            missing_cols_dict[b] = [s_cols[cn] for cn in missing_names]
            print(f"  ❌ 表格 {tgt_tables[b]} 缺少欄位: {sorted(list(missing_names))}")
        if extra_names:
            extra_cols_dict[b] = list(extra_names)
            print(f"  ⚠️  表格 {tgt_tables[b]} 多餘欄位: {sorted(list(extra_names))}")

    return {
        'std_tables': std_tables, 'std_types': std_types, 'std_cols': std_cols,
        'tgt_tables': tgt_tables, 'tgt_types': tgt_types, 'tgt_cols': tgt_cols,
        'missing_tables': missing_tables,
        'extra_tables': extra_tables,
        'missing_cols': missing_cols_dict,
        'extra_cols': extra_cols_dict
    }

if __name__ == '__main__':
    run_precision_check()

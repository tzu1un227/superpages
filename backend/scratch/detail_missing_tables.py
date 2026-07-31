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

from compare_and_sync_5013 import compare_schemas

diff = compare_schemas()

print("\n========================================================")
print("詳細分析 5013 缺少的表格清單 (18 個):")
print("========================================================")
for t in sorted(list(diff['missing_tables'])):
    t_type = diff['std_types'].get(t)
    std_raw_name = diff['std_tables'].get(t)
    print(f" - {t} (Type: {t_type}) -> 原名: {std_raw_name}")

import os
os.environ['ASYNC_MODE'] = 'threading'
import sys
sys.path.insert(0, r'c:\Users\70640\Documents\GitHub\Line-Bot-Main')
import dbModel
from sensors import dboperation
from IOevent import gameevent

print("db_name_pri:", dbModel.db_name_pri)
criterion = [('name', 'tag', 'like'), ('value', "%'new'%", 'like')]

# 1. Test getTable directly
data = dbModel.getTable(dbModel.db_name_pri, criterion, express=['user_id'])
print("Matched with getTable:", data)

# 2. Test g_opr with use_db=True
m = gameevent("test", "", None, "*", "Sensor")
id_list = dboperation.g_opr(m, criterion, use_db=True)
print("Matched with g_opr(use_db=True):", id_list)

# 3. Test g_opr with use_db=False (default before)
id_list_cache = dboperation.g_opr(m, criterion, use_db=False)
print("Matched with g_opr(use_db=False):", id_list_cache)

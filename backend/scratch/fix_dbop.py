path = r"c:\Users\70640\Documents\GitHub\Line-Bot-Main\sensors\dboperation.py"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("def g_opr(m:gameevent,criterion:list=[],amount:int=0,update:str=\"\",use_db=False):", "def g_opr(m:gameevent,criterion:list=[],amount:int=0,update:str=\"\",use_db=True):")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("SUCCESS")

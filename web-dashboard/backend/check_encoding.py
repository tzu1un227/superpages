import os

target = "週".encode('utf-8')
print(f"Target '週' utf-8 bytes: {target}")

if os.path.exists('params.log'):
    with open('params.log', 'rb') as f: # Read bytes
        lines = f.readlines()
        if lines:
            line = lines[-1]
            # Line is bytes.
            # We look for b'period='
            try:
                start_idx = line.find(b'period=')
                if start_idx != -1:
                    # extract until comma
                    end_idx = line.find(b',', start_idx)
                    val = line[start_idx+7 : end_idx]
                    print(f"Found period bytes: {val}")
                    
                    if val == target:
                        print("MATCH!")
                    else:
                        print("MISMATCH!")
                        try:
                            print(f"Decoded: {val.decode('utf-8')}")
                        except:
                            print(f"Decoded (cp950): {val.decode('cp950', errors='replace')}")
            except Exception as e:
                print(e)

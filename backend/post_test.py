
import requests
import json

def test_post(url, data):
    print(f"Testing POST: {url}")
    try:
        r = requests.post(url, json=data, timeout=5, verify=False)
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:200]}")
        return r.status_code < 500
    except Exception as e:
        print(f"Failed: {e}")
        return False

if __name__ == "__main__":
    url = "https://irl-svr.ee.yzu.edu.tw:5013/5013"
    data = {"user": "test", "message": "test", "type": "Sensor"}
    test_post(url, data)
    test_post("https://irl-svr.ee.yzu.edu.tw:5013/", data)
    test_post("https://irl-svr.ee.yzu.edu.tw:5013/api/trigger", data)

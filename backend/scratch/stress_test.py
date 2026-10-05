import time
import json
import ssl
import urllib.request
import urllib.error
import concurrent.futures
import statistics

# Configuration
BASE_URL = "https://irl-svr.ee.yzu.edu.tw:5017"
OA_ID = "5"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6Ilx1OTBiMVx1NWI1MFx1NTAyYiIsImVtYWlsIjoidTg1MDM2NDlAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzkyMDMyODUwfQ.9h37K-5WGK4113-zU9gsXiksXpxmKpQvYpoJKsyrwkk"

ENDPOINTS = [
    ("/api/tags", "輕量端點 (Tags)"),
    ("/api/projects", "中度端點 (Projects)"),
    ("/api/richmenu/metadata", "選單中繼 (RichMenu Metadata)"),
    ("/api/customers?limit=50", "客戶列表 (Customers 50筆)"),
    ("/api/statistics/keywords", "重度計算 (Keyword Stats)")
]

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def single_request(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "X-OA-ID": OA_ID,
        "User-Agent": "Superpages-StressTester/1.0"
    })
    start = time.perf_counter()
    status_code = 0
    err_msg = ""
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            status_code = resp.status
            _ = resp.read()
    except urllib.error.HTTPError as e:
        status_code = e.code
        err_msg = str(e)
    except Exception as e:
        status_code = -1
        err_msg = str(e)
    latency_ms = (time.perf_counter() - start) * 1000
    return status_code, latency_ms, err_msg

def run_stress_tier(path, name, concurrency, duration_sec):
    print(f"\n--- Testing [{name}] with Concurrency={concurrency} for {duration_sec}s ---")
    start_time = time.time()
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = set()
        
        while time.time() - start_time < duration_sec:
            # Keep pool saturated
            while len(futures) < concurrency and (time.time() - start_time < duration_sec):
                futures.add(executor.submit(single_request, path))
            
            # Collect done futures
            done, futures = concurrent.futures.wait(futures, timeout=0.1, return_when=concurrent.futures.FIRST_COMPLETED)
            for f in done:
                results.append(f.result())
        
        # Drain remaining
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    total_reqs = len(results)
    elapsed = time.time() - start_time
    qps = total_reqs / elapsed if elapsed > 0 else 0
    
    success_reqs = [r for r in results if r[0] == 200]
    fail_reqs = [r for r in results if r[0] != 200]
    latencies = [r[1] for r in results]
    
    status_counts = {}
    for r in results:
        status_counts[r[0]] = status_counts.get(r[0], 0) + 1
        
    p50 = statistics.median(latencies) if latencies else 0
    p90 = statistics.quantiles(latencies, n=10)[8] if len(latencies) >= 10 else (max(latencies) if latencies else 0)
    p99 = statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else (max(latencies) if latencies else 0)
    avg_lat = statistics.mean(latencies) if latencies else 0
    
    res_summary = {
        "endpoint": path,
        "name": name,
        "concurrency": concurrency,
        "duration": round(elapsed, 2),
        "total_requests": total_reqs,
        "success_count": len(success_reqs),
        "fail_count": len(fail_reqs),
        "qps": round(qps, 2),
        "avg_ms": round(avg_lat, 2),
        "p50_ms": round(p50, 2),
        "p90_ms": round(p90, 2),
        "p99_ms": round(p99, 2),
        "max_ms": round(max(latencies), 2) if latencies else 0,
        "status_breakdown": status_counts
    }
    
    print(f"Total: {total_reqs} | Success: {len(success_reqs)} | Fail: {len(fail_reqs)} | QPS: {res_summary['qps']}")
    print(f"Latency: Avg={res_summary['avg_ms']}ms, p50={res_summary['p50_ms']}ms, p90={res_summary['p90_ms']}ms, p99={res_summary['p99_ms']}ms")
    print(f"Status codes: {status_counts}")
    return res_summary

if __name__ == "__main__":
    all_summaries = []
    
    # 1. Ramp up test on lightweight endpoint /api/projects
    for conc in [5, 15, 30, 50, 80]:
        summary = run_stress_tier("/api/projects", "旅程列表 (Projects)", conc, duration_sec=8)
        all_summaries.append(summary)
        time.sleep(1)
        
    # 2. Test customers endpoint under medium and high concurrency
    for conc in [10, 30, 60]:
        summary = run_stress_tier("/api/customers?limit=50", "客戶列表 (Customers 50)", conc, duration_sec=8)
        all_summaries.append(summary)
        time.sleep(1)
        
    # 3. Test heavy aggregation endpoint
    for conc in [5, 15, 30]:
        summary = run_stress_tier("/api/statistics/keywords", "關鍵字統計 (Keywords Stats)", conc, duration_sec=8)
        all_summaries.append(summary)
        time.sleep(1)

    with open("backend/scratch/stress_results.json", "w", encoding="utf-8") as f:
        json.dump(all_summaries, f, indent=2, ensure_ascii=False)
    print("\nSaved all stress test results to backend/scratch/stress_results.json")

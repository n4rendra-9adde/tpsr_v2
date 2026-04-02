#!/usr/bin/env python3
import json
import time
import uuid
import statistics
import argparse
import os
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

def http_call(method, url, headers=None, json_body=None, timeout=15.0):
    if headers is None:
        headers = {}
    req_body = None
    if json_body is not None:
        req_body = json.dumps(json_body).encode('utf-8')
        headers['Content-Type'] = 'application/json'

    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode('utf-8')
            status = response.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8') if e.fp else ""
        status = e.code
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return {
            "status": -1,
            "body": str(e),
            "latency_ms": elapsed,
            "error": True
        }
    
    elapsed = (time.time() - start) * 1000
    return {
        "status": status,
        "body": body,
        "latency_ms": elapsed,
        "error": False
    }

def main():
    parser = argparse.ArgumentParser(description="TPSR API Performance Test Runner")
    parser.add_argument("--api-base-url", default="http://localhost:3000/api", help="API base URL")
    parser.add_argument("--requests", type=int, default=20, help="Number of requests per workload")
    parser.add_argument("--concurrency", type=int, default=4, help="Max concurrent requests")
    parser.add_argument("--timeout", type=float, default=15.0, help="Request timeout in seconds")
    parser.add_argument("--report-json", help="Path to write JSON report")

    args = parser.parse_args()

    if args.requests <= 0:
        sys.stderr.write("Error: --requests must be > 0\n")
        sys.exit(1)
    if args.concurrency <= 0:
        sys.stderr.write("Error: --concurrency must be > 0\n")
        sys.exit(1)
    if args.timeout <= 0:
        sys.stderr.write("Error: --timeout must be > 0\n")
        sys.exit(1)
    
    api_base = args.api_base_url.strip()
    if not api_base:
        sys.stderr.write("Error: --api-base-url cannot be empty\n")
        sys.exit(1)

    if api_base.endswith("/"):
        api_base = api_base[:-1]

    health_url = api_base
    if health_url.endswith("/api"):
        health_url = health_url[:-4]
    health_url += "/health"

    print(f"TPSR Performance Test")
    print(f"API Base URL: {api_base}")
    print(f"Requests per workload: {args.requests}")
    print(f"Concurrency: {args.concurrency}\n")

    print("PHASE 1: Health Check")
    health_res = http_call("GET", health_url, timeout=args.timeout)
    if health_res["error"] or health_res["status"] != 200:
        sys.stderr.write(f"Health check failed (HTTP {health_res['status']}): {health_res['body']}\n")
        sys.exit(1)
    try:
        hdata = json.loads(health_res["body"])
        if hdata.get("status") != "ok":
            sys.stderr.write("Health check payload status != 'ok'\n")
            sys.exit(1)
    except Exception:
        sys.stderr.write("Health check JSON parsing failed\n")
        sys.exit(1)
    print("Health check PASS")

    print("\nPHASE 2: Submit Setup")
    epoch_now = int(time.time())
    sbom_id = f"tpsr-perf-{epoch_now}-{uuid.uuid4().hex[:8]}"
    build_id = f"build-{epoch_now}"
    
    sbom_obj = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.4",
        "metadata": {},
        "components": [{"name": "fake", "version": "1.0"}]
    }
    sbom_str = json.dumps(sbom_obj)

    submit_payload = {
        "sbomID": sbom_id,
        "sbom": sbom_str,
        "buildID": build_id,
        "softwareName": "TPSR Performance Test App",
        "softwareVersion": "1.0.0",
        "format": "CycloneDX",
        "offChainRef": "ipfs://tpsr-performance-test",
        "signatures": ["sig-perf-1", "sig-perf-2"]
    }

    submit_res = http_call("POST", f"{api_base}/submit", 
        headers={"x-user-id": "tpsr-perf-submit", "x-user-role": "developer"},
        json_body=submit_payload,
        timeout=args.timeout
    )
    
    if submit_res["status"] != 201:
        sys.stderr.write(f"Submit setup failed (HTTP {submit_res['status']}): {submit_res['body']}\n")
        sys.exit(1)
    
    try:
        submit_data = json.loads(submit_res["body"])
        submitted_hash = submit_data.get("hash", "")
        if submit_data.get("message") != "SBOM submitted successfully" or submit_data.get("sbomID") != sbom_id or not submitted_hash:
            sys.stderr.write(f"Submit setup validation failed: {submit_data}\n")
            sys.exit(1)
    except Exception:
        sys.stderr.write("Submit setup payload JSON parse failed\n")
        sys.exit(1)
        
    print(f"Submit setup PASS. SBOM ID: {sbom_id}, Hash: {submitted_hash}")

    print("\nPHASE 3: Workloads")
    workload_configs = [
        {
            "name": "verify",
            "method": "POST",
            "url": f"{api_base}/verify",
            "headers": {"x-user-id": "tpsr-perf-verify", "x-user-role": "auditor"},
            "body": {"sbomID": sbom_id, "sbom": sbom_str},
            "valid_status": 200,
            "validate": lambda d: "verification" in d
        },
        {
            "name": "history",
            "method": "GET",
            "url": f"{api_base}/history/{sbom_id}",
            "headers": {"x-user-id": "tpsr-perf-history", "x-user-role": "auditor"},
            "body": None,
            "valid_status": 200,
            "validate": lambda d: isinstance(d.get("history"), list)
        },
        {
            "name": "compliance",
            "method": "POST",
            "url": f"{api_base}/compliance-report",
            "headers": {"x-user-id": "tpsr-perf-compliance", "x-user-role": "admin"},
            "body": {"sbomID": sbom_id, "sbom": sbom_str},
            "valid_status": 200,
            "validate": lambda d: "report" in d
        }
    ]

    report = {
        "apiBaseUrl": api_base,
        "sbomID": sbom_id,
        "requestsPerWorkload": args.requests,
        "concurrency": args.concurrency,
        "timeoutSeconds": args.timeout,
        "workloads": {}
    }

    all_pass = True

    def run_workload(w):
        def worker(ix):
            res = http_call(w["method"], w["url"], headers=w["headers"].copy(), json_body=w["body"], timeout=args.timeout)
            is_success = False
            if res["status"] == w["valid_status"]:
                try:
                    data = json.loads(res["body"])
                    if w["validate"](data):
                        is_success = True
                except Exception:
                    pass
            return {
                "success": is_success,
                "latency_ms": res["latency_ms"],
                "status": res["status"]
            }

        start_time = time.time()
        results = []
        with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            results = list(executor.map(worker, range(args.requests)))
        
        elapsed = time.time() - start_time
        
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        latencies = [r["latency_ms"] for r in successful]
        
        statuses = {}
        for r in results:
            s = r["status"]
            statuses[s] = statuses.get(s, 0) + 1

        w_res = {
            "totalRequests": args.requests,
            "successfulRequests": len(successful),
            "failedRequests": len(failed),
            "successRate": len(successful) / args.requests if args.requests else 0,
            "throughputRequestsPerSecond": args.requests / elapsed if elapsed > 0 else 0,
            "statusCodeCounts": statuses
        }

        if latencies:
            w_res["averageLatencyMs"] = sum(latencies) / len(latencies)
            w_res["minLatencyMs"] = min(latencies)
            w_res["maxLatencyMs"] = max(latencies)
            w_res["p50LatencyMs"] = statistics.median(latencies)
            latencies_sorted = sorted(latencies)
            p95_idx = int(len(latencies_sorted) * 0.95)
            if p95_idx >= len(latencies_sorted):
                p95_idx = len(latencies_sorted) - 1
            w_res["p95LatencyMs"] = latencies_sorted[p95_idx]
        else:
            w_res["averageLatencyMs"] = None
            w_res["minLatencyMs"] = None
            w_res["maxLatencyMs"] = None
            w_res["p50LatencyMs"] = None
            w_res["p95LatencyMs"] = None

        return w["name"], w_res

    for w in workload_configs:
        print(f"Running workload: {w['name']}...")
        w_name, w_metrics = run_workload(w)
        report["workloads"][w_name] = w_metrics
        
        print(f"  Success: {w_metrics['successfulRequests']}/{w_metrics['totalRequests']}")
        print(f"  Failures: {w_metrics['failedRequests']}")
        print(f"  Throughput: {w_metrics['throughputRequestsPerSecond']:.2f} req/s")
        if w_metrics['averageLatencyMs'] is not None:
            print(f"  Avg Latency: {w_metrics['averageLatencyMs']:.2f} ms")
            print(f"  P95 Latency: {w_metrics['p95LatencyMs']:.2f} ms")
        print(f"  Status Codes: {w_metrics['statusCodeCounts']}\n")
        
        if w_metrics['failedRequests'] > 0:
            all_pass = False

    if args.report_json:
        try:
            with open(args.report_json, 'w') as f:
                json.dump(report, f, indent=2)
            print(f"JSON report written to: {args.report_json}")
        except Exception as e:
            sys.stderr.write(f"Failed to write JSON report: {e}\n")

    print("OVERALL SUMMARY:")
    if all_pass:
        print("PASS: All workloads executed successfully with 0 failed requests.")
        sys.exit(0)
    else:
        print("FAIL: Some workloads had failed requests.")
        sys.exit(1)

if __name__ == "__main__":
    main()

"""Read-only local/Tailscale monitoring. No credentials are printed or persisted."""
import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from common import open_http


def poll(url, token=None):
    headers = {"Authorization": "Bearer " + token} if token else {}
    try:
        with open_http(urllib.request.Request(url, headers=headers), timeout=10) as response:
            data = json.load(response)
        return {"status": data.get("status", "UNKNOWN"), "alerts": data.get("alerts", [])}
    except urllib.error.HTTPError as error:
        return {"status": "UNAVAILABLE", "httpStatus": error.code}
    except (OSError, ValueError):
        return {"status": "UNAVAILABLE", "message": "No valid response within the timeout."}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Readiness URL or restaurant /api/.../operations URL")
    parser.add_argument("--watch", action="store_true")
    args = parser.parse_args()
    parsed = urllib.parse.urlsplit(args.url)
    if parsed.username or parsed.password or parsed.scheme not in ("http", "https"):
        raise SystemExit("Use an HTTP(S) URL without embedded credentials.")
    if parsed.scheme == "http" and parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise SystemExit("Use HTTPS outside localhost.")
    previous = None
    try:
        while True:
            result = poll(args.url, os.environ.get("TABLEKIND_MONITOR_TOKEN"))
            serialized = json.dumps(result, sort_keys=True)
            if serialized != previous:
                print(time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), serialized, flush=True)
                previous = serialized
            if not args.watch:
                raise SystemExit(0 if result["status"] in ("UP", "OK") else 1)
            time.sleep(30)
    except KeyboardInterrupt:
        print("Monitoring stopped.")

"""Bounded native review on a unique disposable Compose project, never on local/demo databases."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from common import Compose, ROOT, unique_project, dump_database, fingerprint, financial_checks, write_json, open_http
from restore_check import restore_check


class Api:
    def __init__(self, base):
        parsed = urllib.parse.urlsplit(base)
        if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost") or parsed.path not in ("", "/") or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Review HTTP target must be an explicit localhost origin.")
        self.base = base.rstrip("/")
        self.staff = None

    def send(self, token, method, path, body=None, key=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        if method != "GET":
            headers["Idempotency-Key"] = key or str(uuid.uuid4())
        req = urllib.request.Request(self.base + path, method=method, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
        try:
            with open_http(req, timeout=30) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            try:
                data = json.load(error)
            except ValueError:
                data = {"code": "NON_JSON_ERROR"}
            return error.code, data

    def ok(self, token, method, path, body=None, key=None):
        status, result = self.send(token, method, path, body, key)
        if status != 200:
            raise RuntimeError(f"Review API returned {status} ({result.get('code', 'UNKNOWN')}); no automatic repair attempted.")
        return result

    def post(self, path, body=None):
        return self.ok(self.staff, "POST", "/api" + path, body or {})

    def state(self, sid, token=None):
        return self.ok(token or self.staff, "GET", "/api/sessions/" + sid)

    def action(self, token, sid, path, **fields):
        for _ in range(20):
            body = dict(fields, revision=self.state(sid, token)["session"]["revision"])
            key = str(uuid.uuid4())
            status, result = self.send(token, "POST", "/api/sessions/" + sid + path, body, key)
            if status == 200:
                return result, body, key
            if status != 409 or result.get("code") != "STALE_REVISION":
                raise RuntimeError(f"Mutation failed with {status} ({result.get('code', 'UNKNOWN')}).")
        raise RuntimeError("Repeated revision conflicts exceeded the review retry budget.")

    def wait_ready(self):
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            try:
                code, data = self.send(None, "GET", "/actuator/health/readiness")
                if code == 200 and data.get("status") == "UP":
                    return
            except (OSError, ValueError):
                pass
            time.sleep(1)
        raise RuntimeError("Backend readiness did not recover within 120 seconds.")


def fixture(api, tables, guests):
    rid = api.post("/restaurants", {"name": "Operational review " + str(uuid.uuid4())})["id"]
    prefix = "/restaurants/" + rid
    bid = api.post(prefix + "/branches", {"name": "Review branch", "timezone": "Europe/Chisinau",
        "approvalRequired": True, "acceptingOrders": True, "hours": []})["id"]
    category = api.post(prefix + "/categories", {"names": {"en": "Review food"}, "sortOrder": 0})["id"]
    pid = api.post(prefix + "/products", {"categoryId": category, "names": {"en": "Review dish"},
        "descriptions": {}, "allergens": [], "dietaryLabels": [], "priceBani": 10001, "available": True})["id"]
    tids = [api.post(prefix + "/branches/" + bid + "/tables",
        {"label": "Review " + str(i + 1), "pilotEnabled": True, "maxGuests": 20})["id"] for i in range(tables)]
    api.post(prefix + "/pos/connect-test")
    api.post(prefix + "/pos/mock/mode", {"mode": "OFFLINE"})
    people = []
    for tid in tids:
        table = api.post(prefix + "/tables/" + tid + "/sessions")
        sid = table["sessionId"]
        for i in range(guests):
            guest = api.ok(None, "POST", "/api/join", {"token": table["joinToken"], "nickname": "Guest " + str(i + 1)})
            token = guest["accessToken"]
            item, _, _ = api.action(token, sid, "/orders", productId=pid, productVersion=1,
                                     quantity=1, optionIds=[], note="Operational fixture")
            api.action(api.staff, sid, "/orders/" + item["id"] + "/status", status="ACCEPTED", reason="")
            people.append({"sid": sid, "token": token, "id": guest["actorId"]})
    return rid, people


def workload(api, people, reads, p95_limit):
    def visit(person):
        samples = []
        for _ in range(reads):
            start = time.monotonic()
            state = api.state(person["sid"], person["token"])
            own = next(g for g in state["bill"]["guests"] if g["id"] == person["id"])
            assert own["remaining_bani"] == 10001, "Guest's exact unpaid share changed during read load"
            samples.append((time.monotonic() - start) * 1000)
        return samples
    with ThreadPoolExecutor(max_workers=min(20, len(people))) as pool:
        samples = sorted(x for batch in pool.map(visit, people) for x in batch)
    result = {"requests": len(samples), "concurrentClients": min(20, len(people)),
              "p50Ms": round(samples[math.ceil(len(samples)*.5)-1], 2),
              "p95Ms": round(samples[math.ceil(len(samples)*.95)-1], 2),
              "maxMs": round(samples[-1], 2), "p95BudgetMs": p95_limit, "unexpectedErrors": 0}
    if result["p95Ms"] > p95_limit:
        raise RuntimeError("Read-load latency budget exceeded: " + json.dumps(result))
    return result


def payments(api, people):
    def start(person):
        payment, body, key = api.action(person["token"], person["sid"], "/payments",
            target="SELF", guestIds=[], method="CARD", tipBani=0)
        replay = api.ok(person["token"], "POST", "/api/sessions/" + person["sid"] + "/payments", body, key)
        assert replay["id"] == payment["id"], "Receipt replay created a second payment"
        return dict(person, payment=payment["id"], body=body, key=key)
    with ThreadPoolExecutor(max_workers=min(8, len(people))) as pool:
        attempts = list(pool.map(start, people))
    # Model a success whose signed notification never arrived. Local money stays reserved.
    for i, p in enumerate(attempts):
        api.action(api.staff, p["sid"], "/payments/" + p["payment"] + "/test-result",
                   kind="PAYMENT", outcome="SUCCEEDED", deliver=i != 0)
    pending = attempts[0]
    state = api.state(pending["sid"])
    assert next(p for p in state["payments"] if p["id"] == pending["payment"])["status"] == "PENDING"
    assert state["bill"]["reservedBani"] == 10001
    return attempts


def recover(api, rid, attempts):
    pending = attempts[0]
    replay = api.ok(pending["token"], "POST", "/api/sessions/"+pending["sid"]+"/payments", pending["body"], pending["key"])
    assert replay["id"] == pending["payment"]
    for _ in range(2):
        api.action(pending["token"], pending["sid"], "/payments/"+pending["payment"]+"/reconcile")
    prefix = "/restaurants/" + rid + "/pos"
    api.post(prefix + "/mock/mode", {"mode": "ONLINE"})
    dashboard = api.ok(api.staff, "GET", "/api"+prefix)
    for message in dashboard["outbox"]:
        if message["status"] == "FAILED":
            api.post(prefix+"/messages/"+message["id"]+"/retry")
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        status = api.ok(api.staff, "GET", "/api/restaurants/"+rid+"/operations")
        if status["counts"]["queuedPos"] == 0:
            break
        time.sleep(1)
    else:
        raise RuntimeError("POS queue did not drain within three minutes; inspect failed messages.")
    for sid in sorted({p["sid"] for p in attempts}):
        state = api.state(sid)
        expected = 10001 * sum(p["sid"] == sid for p in attempts)
        assert state["bill"]["totalBani"] == expected
        assert state["bill"]["paidBani"] == expected
        assert state["bill"]["remainingBani"] == 0
        assert len(state["payments"]) == expected // 10001
        assert api.ok(api.staff,"GET","/api/sessions/"+sid+"/payments/reconciliation")["balanced"]
        assert api.post(prefix+"/sessions/"+sid+"/reconcile")["status"] == "MATCH"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tables", type=int, default=5)
    parser.add_argument("--guests", type=int, default=4)
    parser.add_argument("--reads", type=int, default=25)
    parser.add_argument("--p95-ms", type=int, default=5000)
    parser.add_argument("--port", type=int, default=5281)
    parser.add_argument("--api-only", action="store_true", help="Supplementary checks against an explicitly supplied local test app; no Docker/backup claims")
    parser.add_argument("--url", help="Only for --api-only")
    args = parser.parse_args()
    if not (1 <= args.tables <= 5 and 1 <= args.guests <= 4 and 1 <= args.reads <= 100 and 1024 <= args.port <= 65535 and args.p95_ms > 0):
        parser.error("Use 1–5 tables, 1–4 guests per table, 1–100 reads, a valid unprivileged port and positive latency budget.")
    if args.api_only != bool(args.url):
        parser.error("--api-only and --url must be used together.")
    compose = None
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime()) + "-" + secrets.token_hex(3)
    output = ROOT / "test-results" / "operations" / stamp
    result = {"status": "running", "nativeChaos": not args.api_only, "checks": [], "configuration": {
        "tables": args.tables, "guestsPerTable": args.guests, "readsPerGuest": args.reads}}
    try:
        if not args.api_only:
            compose = Compose(unique_project("ops"), "compose.ops.yaml", {
                "OPS_DB_PASSWORD": secrets.token_hex(32), "OPS_JWT_SECRET": secrets.token_hex(48),
                "OPS_STAFF_PASSWORD": secrets.token_hex(24), "OPS_WEBHOOK_SECRET": secrets.token_hex(32), "OPS_PORT": str(args.port)})
            print("Creating disposable review project", compose.project, flush=True)
            compose.run("up", "-d", "--build", "--wait", "--wait-timeout", "180", timeout=1200)
        api = Api(args.url if args.api_only else "http://127.0.0.1:"+str(args.port))
        api.wait_ready()
        email = os.environ.get("TEST_STAFF_EMAIL", "manager@tablekind.test") if args.api_only else "ops@tablekind.local"
        password = os.environ.get("TEST_STAFF_PASSWORD", "Local-Review-2026!") if args.api_only else compose.env["OPS_STAFF_PASSWORD"]
        api.staff = api.ok(None,"POST","/api/auth/login",{"email":email,"password":password})["accessToken"]
        print("Creating fictional tables and accepted orders", flush=True)
        rid, people = fixture(api, args.tables, args.guests)
        result["checks"].append("Fictional groups retain exact accepted shares while TEST POS is offline")
        print("Running bounded parallel read workload", flush=True)
        result["load"] = workload(api, people, args.reads, args.p95_ms)
        result["checks"].append("Concurrent guest snapshots return exact balances within the selected latency budget")
        attempts = payments(api, people)
        result["checks"].append("Concurrent TEST payment starts and repeated receipts create one attempt per guest; missing notification keeps its hold")
        if compose:
            print("Interrupting only the disposable backend and database", flush=True)
            compose.run("kill", "-s", "SIGKILL", "backend")
            compose.run("up", "-d", "backend")
            api.wait_ready()
            state = api.state(attempts[0]["sid"])
            assert state["bill"]["reservedBani"] == 10001
            compose.run("stop", "postgres")
            assert api.send(None,"GET","/actuator/health/liveness")[0] == 200
            assert api.send(None,"GET","/actuator/health/readiness")[0] == 503
            code, error = api.send(api.staff,"GET","/api/sessions/"+attempts[0]["sid"])
            assert code == 503 and error["code"] == "DATABASE_UNAVAILABLE", "Database outage must be explicit and bounded"
            compose.run("start", "postgres")
            compose.wait_database("tablekind_ops", "tablekind_ops")
            api.wait_ready()
            result["checks"].append("Backend kill preserves reservations; database outage lowers readiness but not liveness; same process recovers")
        print("Recovering the original payment and queued POS work", flush=True)
        recover(api, rid, attempts)
        result["checks"].append("Provider lookup settles once, all original payments reconcile, and offline POS queue catches up exactly")
        if compose:
            assert int(compose.sql("tablekind_ops","tablekind_ops","SELECT count(*) FROM mock_pos_kitchen_ticket")) == len(people)
            compose.run("stop", "backend")
            expected = fingerprint(compose,"tablekind_ops","tablekind_ops")
            result["financialChecks"] = financial_checks(compose,"tablekind_ops","tablekind_ops")
            backup = dump_database(compose,"tablekind_ops","tablekind_ops",ROOT/"backups"/("ops-"+stamp+".dump"))
            print("Restoring the backup into a second isolated database", flush=True)
            result["restore"] = restore_check(backup, expected)
            result["checks"].append("Custom-format backup restores with identical rows in every table and balanced financial records")
        result["status"] = "passed"
        print(json.dumps(result,indent=2),flush=True)
    except Exception as error:
        result["status"] = "failed"
        result["failureType"] = type(error).__name__
        # No HTTP request headers, passwords or returned bearer bodies in the evidence.
        print("Review stopped:", type(error).__name__, str(error)[:500], flush=True)
        raise
    finally:
        if compose:
            try:
                compose.remove_disposable()
            except Exception:
                result["cleanupRequired"] = compose.project
                print("Automatic cleanup failed for", compose.project, "; its disposable resources may remain.", flush=True)
        write_json(output/"result.json",result)
        print("Sanitized result:",output/"result.json",flush=True)


if __name__ == "__main__":
    main()

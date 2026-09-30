"""Standard-library helpers. Docker is invoked as an argument list, never through a shell."""
from pathlib import Path
import hashlib
import json
import os
import re
import secrets
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """Do not forward bearer credentials or review writes to another endpoint."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_http(request, timeout):
    return urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout)


class Compose:
    def __init__(self, project, filename, env=None, env_file=None):
        self.project = project
        self.env = os.environ.copy()
        self.env.update(env or {})
        self.prefix = ["docker", "compose", "--project-name", project]
        if env_file:
            self.prefix += ["--env-file", str(env_file)]
        self.prefix += ["-f", str(ROOT / filename)]

    def run(self, *args, capture=False, input=None, stdout=None, timeout=600):
        return subprocess.run(self.prefix + list(args), cwd=ROOT, env=self.env, input=input,
                              stdout=subprocess.PIPE if capture else stdout,
                              stderr=subprocess.PIPE if capture else None,
                              check=True, timeout=timeout).stdout

    def sql(self, user, database, query):
        return self.run("exec", "-T", "postgres", "psql", "-X", "-v", "ON_ERROR_STOP=1",
                        "-U", user, "-d", database, "-At", "-c", query, capture=True).decode().strip()

    def wait_database(self, user, database):
        end = time.monotonic() + 90
        while time.monotonic() < end:
            try:
                if self.sql(user, database, "SELECT 1") == "1":
                    return
            except (subprocess.SubprocessError, OSError):
                pass
            time.sleep(1)
        raise RuntimeError("The isolated database did not become ready within 90 seconds.")

    def remove_disposable(self):
        if not re.fullmatch(r"tablekind-(ops|restore)-[a-f0-9]{12}", self.project):
            raise RuntimeError("Refusing cleanup of a non-disposable project.")
        self.run("down", "--volumes", "--remove-orphans")
        print("Removed only disposable containers and volumes for", self.project)


def unique_project(kind):
    if kind not in ("ops", "restore"):
        raise ValueError("Unknown review project kind")
    return "tablekind-" + kind + "-" + secrets.token_hex(6)


def checksum(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def dump_database(compose, user, database, destination):
    destination = Path(destination).resolve()
    partial = destination.with_suffix(destination.suffix + ".partial")
    if destination.exists() or partial.exists():
        raise RuntimeError("Backup already exists; choose a new filename.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with partial.open("xb") as stream:
        compose.run("exec", "-T", "postgres", "pg_dump", "-U", user, "-d", database,
                    "--format=custom", "--no-owner", "--no-privileges", stdout=stream)
    if partial.stat().st_size < 100:
        raise RuntimeError("Backup output was empty or incomplete. The .partial file is not a valid backup.")
    partial.replace(destination)
    manifest = {"format": "postgres-custom", "database": database, "sourceProject": compose.project,
                "bytes": destination.stat().st_size, "sha256": checksum(destination),
                "createdAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "restoreVerified": False, "note": "Preserve the original signing/MFA secret separately and privately."}
    write_json(str(destination) + ".json", manifest)
    return destination


def verify_backup(path):
    path = Path(path).resolve()
    manifest = json.loads(Path(str(path) + ".json").read_text(encoding="utf-8"))
    if path.stat().st_size != manifest["bytes"] or checksum(path) != manifest["sha256"]:
        raise RuntimeError("Backup checksum/size does not match its manifest; do not restore it.")
    return path


def fingerprint(compose, user, database):
    """Fixture-only exact row digests. Run with the source application stopped."""
    tables = compose.sql(user, database,
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename").splitlines()
    result = {}
    for name in tables:
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            raise RuntimeError("Unexpected table identifier in snapshot")
        raw = compose.run("exec", "-T", "postgres", "psql", "-X", "-v", "ON_ERROR_STOP=1",
                          "-U", user, "-d", database, "-At", "-c",
                          f"SELECT row_to_json(t)::text FROM public.{name} t ORDER BY row_to_json(t)::text",
                          capture=True)
        result[name] = {"rows": len(raw.splitlines()), "sha256": hashlib.sha256(raw).hexdigest()}
    return result


def financial_checks(compose, user, database):
    queries = {
        "unbalancedItemAllocations": "SELECT count(*) FROM order_item i WHERE coalesce((SELECT sum(amount_bani) FROM bill_entry b WHERE b.item_id=i.id),0) <> coalesce((SELECT sum(amount_bani) FROM allocation_entry a WHERE a.item_id=i.id),0)",
        "unbalancedPaymentSettlements": "SELECT count(*) FROM payment_attempt p WHERE coalesce((SELECT sum(amount_bani) FROM settlement_entry s WHERE s.payment_id=p.id),0) <> CASE WHEN p.status='SUCCEEDED' THEN p.amount_bani-coalesce((SELECT sum(amount_bani) FROM payment_refund r WHERE r.payment_id=p.id AND r.status='SUCCEEDED'),0) ELSE 0 END",
        "failedMigrations": "SELECT count(*) FROM flyway_schema_history WHERE NOT success",
    }
    result = {key: int(compose.sql(user, database, query)) for key, query in queries.items()}
    if any(result.values()):
        raise RuntimeError("Restored financial/migration checks failed: " + json.dumps(result))
    return result

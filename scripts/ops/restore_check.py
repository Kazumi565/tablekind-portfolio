"""Restore only to a new isolated database. Never overwrites a working installation."""
import argparse
import secrets
import time
from pathlib import Path
from common import Compose, unique_project, verify_backup, fingerprint, financial_checks, write_json, checksum


def restore_check(backup, expected=None):
    backup = verify_backup(backup)
    compose = Compose(unique_project("restore"), "compose.restore.yaml", {"RESTORE_PASSWORD": secrets.token_hex(32)})
    started = time.monotonic()
    try:
        compose.run("up", "-d", "--wait", "--wait-timeout", "90")
        compose.run("cp", str(backup), "postgres:/tmp/restore.dump")
        compose.run("exec", "-T", "postgres", "pg_restore", "-U", "tablekind_restore", "-d", "tablekind_restore",
                    "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", "/tmp/restore.dump")
        checks = financial_checks(compose, "tablekind_restore", "tablekind_restore")
        table_count = int(compose.sql("tablekind_restore", "tablekind_restore", "SELECT count(*) FROM pg_tables WHERE schemaname='public'"))
        if expected is not None:
            rows = fingerprint(compose, "tablekind_restore", "tablekind_restore")
            if rows != expected:
                raise RuntimeError("Restored rows differ from the stopped source snapshot.")
        result = {"status": "passed", "elapsedSeconds": round(time.monotonic()-started, 2),
                  "backupSha256": checksum(backup),
                  "financialChecks": checks, "tableCount": table_count,
                  "exactSourceComparison": expected is not None,
                  "note": "Isolated database restoration only; no original database was changed. This does not prove MFA secrets are recoverable."}
        write_json(str(backup) + ".restore.json", result)
        return result
    finally:
        compose.remove_disposable()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup", type=Path, required=True)
    args = parser.parse_args()
    print(restore_check(args.backup))

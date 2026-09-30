"""Read-only backup of an existing local or private-demo database. Never stops it."""
import argparse
import time
from common import Compose, ROOT, dump_database


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stack", choices=["local", "demo"], required=True)
    args = parser.parse_args()
    demo = args.stack == "demo"
    env_file = ROOT / ".env.demo" if demo else None
    if demo and not env_file.exists():
        raise SystemExit("Missing .env.demo. Keep the existing file; do not generate replacement secrets.")
    compose = Compose("tablekind-demo" if demo else "tablekind-local",
                      "compose.demo.yaml" if demo else "compose.yaml", env_file=env_file)
    database = "tablekind_demo" if demo else "tablekind"
    if compose.sql(database, database, "SELECT current_database()") != database:
        raise SystemExit("Unexpected database; backup stopped.")
    stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    path = dump_database(compose, database, database, ROOT / "backups" / f"{args.stack}-{stamp}.dump")
    print("Backup:", path)
    print("Checksum manifest:", str(path) + ".json")
    print("This contains private data. Keep it out of Git and preserve the signing secret separately.")
    print("Next: py scripts/ops/restore_check.py --backup <the dump path>")


if __name__ == "__main__":
    main()

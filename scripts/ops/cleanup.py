"""Remove only the exact disposable operational project printed by a previous review."""
import argparse
import re
from common import Compose


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    args = parser.parse_args()
    match = re.fullmatch(r"tablekind-(ops|restore)-[a-f0-9]{12}", args.project)
    if not match:
        parser.error("Only an exact disposable tablekind-ops/restore project is permitted.")
    # Values only satisfy Compose interpolation during down; no service is created or logged in.
    unused = {key: "cleanup-only-unused" for key in (
        "OPS_DB_PASSWORD", "OPS_JWT_SECRET", "OPS_STAFF_PASSWORD", "OPS_WEBHOOK_SECRET", "RESTORE_PASSWORD")}
    Compose(args.project, "compose." + match[1] + ".yaml", unused).remove_disposable()

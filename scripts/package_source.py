"""Create the portable source archive without dependencies, secrets or build caches."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parents[1]
destination = Path(sys.argv[1]).resolve()
if destination.is_relative_to(root):
    raise SystemExit("Place the source ZIP outside the source directory.")
destination.parent.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', 'target', 'dist', '.git', '.idea', '.vscode', '.venv', '.ssh', '__pycache__', 'test-results', 'playwright-report', 'backups', 'ops-private', 'security-review', 'coverage'}
with ZipFile(destination, 'x', ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob('*')):
        rel = path.relative_to(root)
        name = path.name.lower()
        secret = name == '.env' or name.startswith('.env.') or name.startswith('secrets.') or name in {'id_rsa', 'id_ed25519', 'id_ecdsa'}
        screenshot = rel.parts[:2] == ('docs', 'verification') and path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp'}
        private_name = any(word in path.name.lower() for word in ('credentials', 'access-token', 'private-key'))
        dump_sql = path.suffix.lower() == '.sql' and rel.parts[:6] != ('backend', 'src', 'main', 'resources', 'db', 'migration')
        if not path.is_file() or path.is_symlink() or any(part.lower() in excluded for part in rel.parts) or secret or screenshot or private_name or dump_sql or path.name == '.DS_Store' or path.suffix.lower() in {'.log', '.dump', '.partial', '.backup', '.bak', '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.kdbx', '.tfstate', '.sqlite', '.sqlite3', '.zip', '.7z', '.tar', '.gz', '.pyc'}:
            continue
        archive.write(path, Path('tablekind-spring') / rel)
print(destination)

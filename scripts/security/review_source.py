"""Check publication paths and private identifiers without printing their values.

Use --staged to inspect every blob in the Git index, including unchanged files.
This supplements Gitleaks. It is not a security certification or history scan.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

PRIVATE_DIRS = {
    '.git', 'node_modules', 'target', 'dist', 'backups', 'ops-private',
    'test-results', 'playwright-report', '__pycache__', '.idea', '.venv',
    'security-review', 'coverage', '.vscode', '.ssh',
}
PRIVATE_SUFFIXES = {
    '.dump', '.backup', '.bak', '.partial', '.pem', '.key', '.p12', '.pfx',
    '.sqlite', '.sqlite3', '.log', '.zip', '.7z', '.tar', '.gz', '.pyc',
    '.jks', '.keystore', '.kdbx', '.tfstate',
}
PATTERNS = {
    'private-tailnet-address': re.compile(r'\b(?:[\w-]+\.)?tail[a-z0-9]{6,}\.ts\.net\b', re.I),
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
    'github-token': re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})'),
    'tailscale-token': re.compile(r'\btskey-[A-Za-z0-9_-]{20,}'),
    'literal-bearer': re.compile(r'\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}'),
}


def path_problem(name: str) -> bool:
    p = PurePosixPath(name.replace('\\', '/'))
    parts = tuple(x.lower() for x in p.parts)
    leaf = p.name.lower()
    return (
        p.is_absolute() or '..' in parts
        or any(x in PRIVATE_DIRS for x in parts)
        or leaf == '.env' or leaf.startswith('.env.')
        or leaf.startswith('secrets.') or leaf in {'id_rsa', 'id_ed25519', 'id_ecdsa'}
        or p.suffix.lower() in PRIVATE_SUFFIXES
        or any(x in leaf for x in ('credentials', 'access-token', 'private-key'))
        or (p.suffix.lower() == '.sql' and parts[:6] != (
            'backend', 'src', 'main', 'resources', 'db', 'migration'))
    )


def inspect(name: str, data: bytes) -> tuple[list[dict], bool]:
    findings = []
    if path_problem(name):
        findings.append({'file': name, 'rule': 'private-or-generated-path'})
    try:
        text = data.decode('utf-8')
    except UnicodeError:
        return findings, True
    for number, line in enumerate(text.splitlines(), 1):
        for rule, pattern in PATTERNS.items():
            if pattern.search(line):
                findings.append({'file': name, 'line': number, 'rule': rule})
    return findings, False


def git(root: Path, *args: str) -> bytes:
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True)
    if result.returncode:
        # Git stderr may contain remote URLs or other private values.
        raise RuntimeError('Git inspection failed. Check this is the intended repository.')
    return result.stdout


def run(root: Path, staged: bool) -> dict:
    findings, binary_review, count = [], [], 0
    if staged:
        entries = git(root, 'ls-files', '--stage', '-z').split(b'\0')
        for entry in entries:
            if not entry:
                continue
            meta, raw_name = entry.split(b'\t', 1)
            mode, oid, stage = meta.decode('ascii').split()
            name = raw_name.decode('utf-8')
            if stage != '0' or mode not in {'100644', '100755'}:
                findings.append({'file': name, 'rule': 'conflict-symlink-or-submodule'})
                continue
            data = git(root, 'cat-file', 'blob', oid)
            matched, binary = inspect(name, data)
            findings.extend(matched)
            if binary:
                binary_review.append(name)
            count += 1
    else:
        # Intended for a freshly extracted source ZIP, before installing packages.
        for path in sorted(root.rglob('*')):
            name = path.relative_to(root).as_posix()
            if path.is_symlink():
                findings.append({'file': name, 'rule': 'symlink'})
            elif path.is_file():
                matched, binary = inspect(name, path.read_bytes())
                findings.extend(matched)
                if binary:
                    binary_review.append(name)
                count += 1
    if count == 0:
        raise RuntimeError('No source files were inspected. Publication check cannot pass.')
    return {
        'status': 'blocked' if findings else 'no_automatic_findings',
        'scope': 'complete Git index' if staged else 'extracted source directory',
        'filesInspected': count,
        'findings': findings,
        'binaryFilesForVisualReview': binary_review,
        'limitations': 'Run Gitleaks separately. Review text and images manually. No Git history or hosted metadata was checked.',
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--staged', action='store_true')
    args = parser.parse_args()
    try:
        report = run(args.root.resolve(), args.staged)
        print(json.dumps(report, indent=2))
        return 1 if report['findings'] else 0
    except (OSError, UnicodeError, RuntimeError, ValueError):
        print('Publication inspection failed. Do not treat this as a clean scan.', file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())

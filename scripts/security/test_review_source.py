"""Regression checks for the publication gate; all fixture values are synthetic."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('review_source', Path(__file__).with_name('review_source.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PublicationChecks(unittest.TestCase):
    def test_private_paths_and_migrations(self):
        for name in ['.env.demo', 'BACKUPS/db.dump', 'db.sql', 'secret.pem', 'node_modules/a/index.js', 'source.zip']:
            self.assertTrue(module.path_problem(name), name)
        self.assertFalse(module.path_problem('backend/src/main/resources/db/migration/V1__schema.sql'))
        self.assertFalse(module.path_problem('docs/assets/overview.svg'))

    def test_values_are_never_returned(self):
        value = 'ghp_' + 'X' * 36
        findings, binary = module.inspect('config.txt', ('token=' + value).encode())
        self.assertFalse(binary)
        self.assertEqual('github-token', findings[0]['rule'])
        self.assertNotIn(value, str(findings))

    def test_network_identifier_and_reserved_fixture(self):
        hostname = 'demo.' + 'tail' + 'abcdef' + '.ts.net'
        self.assertTrue(module.inspect('test.txt', hostname.encode())[0])
        self.assertFalse(module.inspect('test.txt', b'https://demo.tablekind.test')[0])

    def test_binary_requires_visual_review(self):
        findings, binary = module.inspect('docs/assets/overview.png', b'\x89PNG\x00\xff')
        self.assertEqual([], findings)
        self.assertTrue(binary)

    def test_empty_directory_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(RuntimeError):
                module.run(Path(directory), False)

    def test_staged_scan_catches_ignored_tracked_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                subprocess.run(['git', '-C', directory, *args], check=True, capture_output=True)
            git('init', '-q')
            (root / '.gitignore').write_text('.env*\n')
            (root / '.env.demo').write_text('LOCAL_TEST_ONLY=example\n')
            git('add', '.gitignore')
            git('add', '-f', '.env.demo')
            report = module.run(root, True)
            self.assertEqual('blocked', report['status'])
            self.assertEqual('.env.demo', report['findings'][0]['file'])


if __name__ == '__main__':
    unittest.main()

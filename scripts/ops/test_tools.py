"""Non-Docker safety/unit checks for the operational helpers."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from common import Compose, checksum, verify_backup, unique_project, dump_database, NoRedirect
from review import Api


class SafetyTests(unittest.TestCase):
    def test_cleanup_refuses_working_projects(self):
        for name in ("tablekind-local", "tablekind-demo", "tablekind-ops", "tablekind-restore-"):
            with self.assertRaises(RuntimeError):
                Compose(name, "compose.yaml").remove_disposable()

    def test_disposable_cleanup_is_exact(self):
        c = Compose(unique_project("ops"), "compose.ops.yaml")
        with patch.object(c, "run") as run:
            c.remove_disposable()
            run.assert_called_once_with("down", "--volumes", "--remove-orphans")

    def test_corruption_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/"fixture.dump"
            p.write_bytes(b"private fixture bytes")
            Path(str(p)+".json").write_text(json.dumps({"bytes":p.stat().st_size,"sha256":checksum(p)}))
            self.assertEqual(p.resolve(),verify_backup(p))
            p.write_bytes(b"changed")
            with self.assertRaises(RuntimeError):
                verify_backup(p)

    def test_dump_refuses_overwriting_existing_backups(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder)/"fixture.dump"
            p.write_bytes(b"existing")
            with self.assertRaises(RuntimeError):
                dump_database(Compose("tablekind-local","compose.yaml"),"u","d",p)
            self.assertEqual(b"existing",p.read_bytes())

    def test_binary_backup_preserves_bytes(self):
        payload = b"PGDMP\x00\r\n\xff" * 30
        with tempfile.TemporaryDirectory() as folder:
            c=Compose("tablekind-local","compose.yaml")
            def dump(*args, **kwargs):
                kwargs["stdout"].write(payload)
            with patch.object(c,"run",side_effect=dump):
                p=dump_database(c,"u","d",Path(folder)/"new.dump")
            self.assertEqual(payload,p.read_bytes())
            self.assertEqual(p,verify_backup(p))

    def test_review_target_cannot_be_remote(self):
        for url in ("https://example.com", "http://10.0.0.1", "http://localhost/api", "http://secret@localhost", "http://localhost?x=1"):
            with self.assertRaises(ValueError):
                Api(url)

    def test_redirects_cannot_forward_credentials(self):
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, "Found", {}, "https://example.com"))


if __name__ == "__main__":
    unittest.main()

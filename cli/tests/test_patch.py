"""Tests for the backup patch logic, run against a synthetic backup folder."""

import io
import plistlib
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import supervise  # noqa: E402

UDID = "00008140-000A1B2C3D4E5F60"
OTHER_UDID = "00008140-000B2C3D4E5F6071"
ARCHIVE_FOLDER = f"{UDID}-20260910-162122"
FILE_ID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"

BASE_CONTENT = {
    "AllowPairing": True,
    "CloudConfigurationUIComplete": False,
    "ConfigurationSource": 0,
    "IsSupervised": False,
    "PostSetupProfileWasInstalled": True,
}


def make_file_blob(size: int) -> bytes:
    """A small NSKeyedArchiver blob shaped like the one Manifest.db stores."""
    archive = {
        "$version": 100000,
        "$archiver": "NSKeyedArchiver",
        "$top": {"root": plistlib.UID(1)},
        "$objects": [
            "$null",
            {
                "$class": plistlib.UID(2),
                "RelativePath": plistlib.UID(3),
                "Size": size,
                "Mode": 33188,
                "Flags": 4,
            },
            {"$classname": "MBFile", "$classes": ["MBFile", "NSObject"]},
            supervise.SUPERVISION_RELATIVE_PATH,
        ],
    }
    return plistlib.dumps(archive, fmt=plistlib.FMT_BINARY)


def build_backup(root: Path, content: dict, plist_format, folder=None, udid=UDID) -> Path:
    backup_dir = root / (folder or udid)
    (backup_dir / FILE_ID[:2]).mkdir(parents=True)

    manifest = {
        "IsEncrypted": False,
        "Version": "10.0",
        "Date": datetime(2026, 9, 10, 14, 12),
        "Lockdown": {
            "ProductVersion": "26.6.1",
            "ProductType": "iPhone17,3",
            "DeviceName": "Test iPhone",
            "UniqueDeviceID": udid,
        },
    }
    with open(backup_dir / supervise.MANIFEST_PLIST_NAME, "wb") as handle:
        plistlib.dump(manifest, handle)

    data = plistlib.dumps(content, fmt=plist_format)
    (backup_dir / FILE_ID[:2] / FILE_ID).write_bytes(data)

    connection = sqlite3.connect(str(backup_dir / supervise.MANIFEST_DB_NAME))
    connection.execute(
        "CREATE TABLE Files "
        "(fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)"
    )
    connection.execute(
        "INSERT INTO Files VALUES (?, ?, ?, ?, ?)",
        (
            FILE_ID,
            supervise.SUPERVISION_DOMAIN,
            supervise.SUPERVISION_RELATIVE_PATH,
            1,
            make_file_blob(len(data)),
        ),
    )
    connection.commit()
    connection.close()
    return backup_dir


class PatchTestCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def content_bytes(self, backup) -> bytes:
        return backup.content_path.read_bytes()


class XmlPlistTest(PatchTestCase):
    """The normal case. The file stays the same size and Manifest.db is untouched."""

    def setUp(self):
        super().setUp()
        self.backup_dir = build_backup(self.root, dict(BASE_CONTENT), plistlib.FMT_XML)
        self.original = (self.backup_dir / FILE_ID[:2] / FILE_ID).read_bytes()

    def test_load_backup_reads_the_supervision_row(self):
        backup = supervise.load_backup(self.backup_dir)
        self.assertEqual(backup.udid, UDID)
        self.assertEqual(backup.device_name, "Test iPhone")
        self.assertEqual(backup.ios_version, "26.6.1")
        self.assertFalse(backup.encrypted)
        self.assertTrue(backup.has_supervision_row)
        self.assertIs(backup.is_supervised, False)
        self.assertEqual(backup.recorded_size, len(self.original))

    def test_patch_keeps_the_size_and_leaves_the_manifest_alone(self):
        backup = supervise.load_backup(self.backup_dir)
        manifest_before = backup.manifest_db.read_bytes()

        plan = supervise.plan_patch(self.content_bytes(backup), backup.recorded_size)
        self.assertEqual(plan.plist_format, "xml")
        self.assertGreater(plan.padding, 0)
        self.assertIsNone(plan.new_recorded_size)
        self.assertEqual(len(plan.new_bytes), backup.recorded_size)

        pristine_dir = supervise.save_pristine(backup)
        supervise.apply_patch(backup, plan)

        self.assertEqual(supervise.verify_patch(backup), backup.recorded_size)
        patched = plistlib.loads(self.content_bytes(backup))
        self.assertIs(patched["IsSupervised"], True)
        self.assertIs(patched["CloudConfigurationUIComplete"], True)
        self.assertIs(patched["AllowPairing"], True)
        self.assertEqual(backup.content_path.stat().st_size, backup.recorded_size)
        self.assertEqual(backup.manifest_db.read_bytes(), manifest_before)

        self.assertTrue((pristine_dir / FILE_ID).is_file())
        self.assertTrue((pristine_dir / supervise.MANIFEST_DB_NAME).is_file())
        self.assertTrue((pristine_dir / supervise.PRISTINE_META_NAME).is_file())
        self.assertEqual((pristine_dir / FILE_ID).read_bytes(), self.original)

    def test_unpatch_puts_back_the_exact_bytes(self):
        backup = supervise.load_backup(self.backup_dir)
        manifest_before = backup.manifest_db.read_bytes()
        plan = supervise.plan_patch(self.content_bytes(backup), backup.recorded_size)
        supervise.save_pristine(backup)
        supervise.apply_patch(backup, plan)
        self.assertNotEqual(self.content_bytes(backup), self.original)

        supervise.restore_pristine(backup)
        self.assertEqual(self.content_bytes(backup), self.original)
        self.assertEqual(backup.manifest_db.read_bytes(), manifest_before)
        self.assertIs(supervise.load_backup(self.backup_dir).is_supervised, False)

    def test_a_supervised_backup_needs_no_change(self):
        content = dict(BASE_CONTENT)
        content["IsSupervised"] = True
        content["CloudConfigurationUIComplete"] = True
        data = plistlib.dumps(content, fmt=plistlib.FMT_XML)
        plan = supervise.plan_patch(data, len(data))
        self.assertEqual(plan.changes, [])
        self.assertIsNone(plan.new_recorded_size)


class BinaryPlistTest(PatchTestCase):
    """A binary plist that is missing the key. The file grows, so Manifest.db is updated."""

    def setUp(self):
        super().setUp()
        content = dict(BASE_CONTENT)
        del content["IsSupervised"]
        self.backup_dir = build_backup(self.root, content, plistlib.FMT_BINARY)
        self.original = (self.backup_dir / FILE_ID[:2] / FILE_ID).read_bytes()

    def test_patch_updates_the_recorded_size(self):
        backup = supervise.load_backup(self.backup_dir)
        self.assertIsNone(backup.is_supervised)

        plan = supervise.plan_patch(self.content_bytes(backup), backup.recorded_size)
        self.assertEqual(plan.plist_format, "binary")
        self.assertEqual(plan.padding, 0)
        self.assertIsNotNone(plan.new_recorded_size)
        self.assertGreater(plan.new_recorded_size, backup.recorded_size)

        supervise.save_pristine(backup)
        supervise.apply_patch(backup, plan)

        new_size = supervise.verify_patch(backup)
        self.assertEqual(new_size, plan.new_recorded_size)
        patched = plistlib.loads(self.content_bytes(backup))
        self.assertIs(patched["IsSupervised"], True)
        self.assertIs(patched["CloudConfigurationUIComplete"], True)

        row = supervise.read_supervision_row(self.backup_dir)
        self.assertEqual(supervise.read_blob_size(row[1]), new_size)

    def test_unpatch_puts_back_the_file_and_the_recorded_size(self):
        backup = supervise.load_backup(self.backup_dir)
        plan = supervise.plan_patch(self.content_bytes(backup), backup.recorded_size)
        supervise.save_pristine(backup)
        supervise.apply_patch(backup, plan)

        supervise.restore_pristine(backup)
        self.assertEqual(self.content_bytes(backup), self.original)
        row = supervise.read_supervision_row(self.backup_dir)
        self.assertEqual(supervise.read_blob_size(row[1]), len(self.original))


class BackupRootTest(PatchTestCase):
    """The commands must read the backup root at call time, not at import time."""

    def test_find_backups_follows_the_current_backup_root(self):
        build_backup(self.root, dict(BASE_CONTENT), plistlib.FMT_XML)
        real_root = supervise.BACKUP_ROOT
        supervise.BACKUP_ROOT = self.root
        self.addCleanup(setattr, supervise, "BACKUP_ROOT", real_root)

        self.assertEqual(supervise.find_backups(), [self.root / UDID])
        self.assertEqual(supervise.select_backup().path, self.root / UDID)


class ArchiveCopyTest(PatchTestCase):
    """Finder keeps dated archive copies of a backup beside the current folder."""

    def use_root(self) -> None:
        real_root = supervise.BACKUP_ROOT
        supervise.BACKUP_ROOT = self.root
        self.addCleanup(setattr, supervise, "BACKUP_ROOT", real_root)

    def select(self, udid=None):
        output = io.StringIO()
        with redirect_stdout(output):
            backup = supervise.select_backup(udid)
        return backup, output.getvalue()

    def build_pair(self) -> None:
        build_backup(self.root, dict(BASE_CONTENT), plistlib.FMT_XML)
        build_backup(self.root, dict(BASE_CONTENT), plistlib.FMT_XML, folder=ARCHIVE_FOLDER)
        self.use_root()

    def test_check_names_the_folder_and_the_kind(self):
        self.build_pair()
        kinds = {
            item["folder"]: item["kind"]
            for item in (
                supervise.backup_as_dict(backup) for backup in supervise.load_backups()
            )
        }
        self.assertEqual(kinds, {UDID: "current", ARCHIVE_FOLDER: "archive"})

    def test_a_bare_udid_picks_the_current_folder(self):
        self.build_pair()
        backup, output = self.select(UDID)
        self.assertEqual(backup.path, self.root / UDID)
        self.assertIn(UDID, output)
        self.assertIn("--udid <folder name>", output)

    def test_a_folder_name_picks_the_archive_copy(self):
        self.build_pair()
        backup, _ = self.select(ARCHIVE_FOLDER)
        self.assertEqual(backup.path, self.root / ARCHIVE_FOLDER)

    def test_one_udid_in_two_folders_needs_no_udid_flag(self):
        self.build_pair()
        backup, _ = self.select()
        self.assertEqual(backup.path, self.root / UDID)

    def test_two_devices_still_need_the_udid_flag(self):
        build_backup(self.root, dict(BASE_CONTENT), plistlib.FMT_XML)
        build_backup(
            self.root, dict(BASE_CONTENT), plistlib.FMT_XML, folder=OTHER_UDID, udid=OTHER_UDID
        )
        self.use_root()
        with self.assertRaises(supervise.Refusal):
            supervise.select_backup()


if __name__ == "__main__":
    unittest.main()

"""Tests for the encrypted backup path, run against a synthetic encrypted backup."""

import hashlib
import io
import json
import os
import plistlib
import shutil
import sqlite3
import struct
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from supervise_iphone import cli as supervise  # noqa: E402

PASSWORD = "open sesame"
OTHER_PASSWORD = "open barley"
UDID = "00008140-000C3D4E5F607182"
FILE_ID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"
MANIFEST_CLASS = 4
FILE_CLASS = 3
# The real keybag runs ten million rounds. The tests only need the shape.
ROUNDS = 1000

CONTENT = {
    "AllowPairing": True,
    "CloudConfigurationUIComplete": False,
    "ConfigurationSource": 0,
    "IsSupervised": False,
    "PostSetupProfileWasInstalled": True,
}
# The real file on an iPhone SE at iOS 26.2.1 is a binary plist of 209 bytes that
# shrinks when both flags flip, because the last false object drops out of the
# object table. This one has the same shape and the same 209 bytes.
RESIZED_CONTENT = dict(CONTENT, OrganizationMagic="0123456789")


def wrap_key(wrapping_key: bytes, plain: bytes) -> bytes:
    """The other half of RFC 3394, so a test can build what the tool unwraps."""
    cipher = supervise.AES(wrapping_key)
    blocks = [plain[offset:offset + 8] for offset in range(0, len(plain), 8)]
    count = len(blocks)
    header = int.from_bytes(supervise.KEY_WRAP_IV, "big")
    for round_number in range(6):
        for index in range(count):
            wrapped = cipher.encrypt_block(header.to_bytes(8, "big") + blocks[index])
            header = int.from_bytes(wrapped[:8], "big") ^ (count * round_number + index + 1)
            blocks[index] = wrapped[8:]
    return header.to_bytes(8, "big") + b"".join(blocks)


def record(tag: bytes, value) -> bytes:
    if isinstance(value, int):
        value = struct.pack(">L", value)
    return tag + struct.pack(">L", len(value)) + value


def password_key(password: str, salt: bytes, device_salt: bytes) -> bytes:
    first = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), device_salt, ROUNDS, 32)
    return hashlib.pbkdf2_hmac("sha1", first, salt, ROUNDS, 32)


def build_keybag(password: str, class_keys: dict, second_stage: bool = True) -> bytes:
    """A keybag in the shape iOS writes: a header, then one record per class key."""
    salt = b"S" * 20
    device_salt = b"D" * 20
    header = [
        record(b"VERS", 4),
        record(b"TYPE", 1),
        record(b"UUID", b"U" * 16),
        record(b"HMCK", b"H" * 40),
        record(b"WRAP", 0),
        record(b"SALT", salt),
        record(b"ITER", ROUNDS),
    ]
    if second_stage:
        header += [
            record(b"DPWT", 1),
            record(b"DPIC", ROUNDS),
            record(b"DPSL", device_salt),
        ]
    blob = b"".join(header)
    key = password_key(password, salt, device_salt)
    for protection_class, class_key in class_keys.items():
        blob += b"".join(
            [
                record(b"UUID", bytes([protection_class]) * 16),
                record(b"CLAS", protection_class),
                record(b"WRAP", supervise.WRAP_PASSCODE),
                record(b"WPKY", wrap_key(key, class_key)),
                record(b"KTYP", 0),
            ]
        )
    return blob


def make_file_blob(size: int, wrapped_key: bytes) -> bytes:
    """An NSKeyedArchiver blob with the encryption key an encrypted backup records."""
    archive = {
        "$version": 100000,
        "$archiver": "NSKeyedArchiver",
        "$top": {"root": plistlib.UID(1)},
        "$objects": [
            "$null",
            {
                "$class": plistlib.UID(2),
                "RelativePath": plistlib.UID(3),
                "EncryptionKey": plistlib.UID(4),
                "Size": size,
                "Mode": 33188,
                "Flags": 4,
                "ProtectionClass": FILE_CLASS,
            },
            {"$classname": "MBFile", "$classes": ["MBFile", "NSObject"]},
            supervise.SUPERVISION_RELATIVE_PATH,
            {
                "$class": plistlib.UID(5),
                "NS.data": struct.pack("<L", FILE_CLASS) + wrapped_key,
            },
            {"$classname": "NSMutableData", "$classes": ["NSMutableData", "NSData", "NSObject"]},
        ],
    }
    return plistlib.dumps(archive, fmt=plistlib.FMT_BINARY)


def build_manifest_db(root: Path, blob: bytes, key: bytes, journal_mode: str = "delete") -> bytes:
    """Make a real sqlite file with the one row, then encrypt it whole."""
    scratch = root / "scratch"
    scratch.mkdir(parents=True, exist_ok=True)
    database = scratch / supervise.MANIFEST_DB_NAME
    connection = sqlite3.connect(str(database))
    connection.execute(f"PRAGMA journal_mode={journal_mode}")
    connection.execute(
        "CREATE TABLE Files "
        "(fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)"
    )
    connection.execute(
        "INSERT INTO Files VALUES (?, ?, ?, ?, ?)",
        (FILE_ID, supervise.SUPERVISION_DOMAIN, supervise.SUPERVISION_RELATIVE_PATH, 1, blob),
    )
    connection.commit()
    connection.close()
    plain = database.read_bytes()
    shutil.rmtree(scratch)
    if len(plain) % 16:
        plain += b"\x00" * (16 - len(plain) % 16)
    return supervise.aes_cbc_encrypt(key, plain)


def build_encrypted_backup(
    root: Path, content: dict, plist_format=plistlib.FMT_XML, journal_mode: str = "delete"
) -> Path:
    """A backup folder that holds what Finder writes when the backup is encrypted."""
    backup_dir = root / UDID
    (backup_dir / FILE_ID[:2]).mkdir(parents=True)

    class_keys = {2: os.urandom(32), FILE_CLASS: os.urandom(32), MANIFEST_CLASS: os.urandom(32)}
    manifest_key = os.urandom(32)
    file_key = os.urandom(32)

    plain = plistlib.dumps(content, fmt=plist_format)
    (backup_dir / FILE_ID[:2] / FILE_ID).write_bytes(
        supervise.aes_cbc_encrypt(file_key, supervise.add_padding(plain))
    )
    blob = make_file_blob(len(plain), wrap_key(class_keys[FILE_CLASS], file_key))
    (backup_dir / supervise.MANIFEST_DB_NAME).write_bytes(
        build_manifest_db(root, blob, manifest_key, journal_mode)
    )

    manifest = {
        "IsEncrypted": True,
        "Version": "10.0",
        "Date": datetime(2026, 9, 10, 14, 12),
        "BackupKeyBag": build_keybag(PASSWORD, class_keys),
        "ManifestKey": struct.pack("<L", MANIFEST_CLASS)
        + wrap_key(class_keys[MANIFEST_CLASS], manifest_key),
        "Lockdown": {
            "ProductVersion": "26.6.1",
            "ProductType": "iPhone17,3",
            "DeviceName": "Test iPhone",
            "UniqueDeviceID": UDID,
        },
    }
    with open(backup_dir / supervise.MANIFEST_PLIST_NAME, "wb") as handle:
        plistlib.dump(manifest, handle)
    return backup_dir


class AesTest(unittest.TestCase):
    """Known answers from FIPS 197 and RFC 3394. A wrong table shows up here."""

    KEY = bytes.fromhex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")

    def test_the_fips_197_vector_for_aes_256(self):
        cipher = supervise.AES(self.KEY)
        plain = bytes.fromhex("00112233445566778899aabbccddeeff")
        encrypted = bytes.fromhex("8ea2b7ca516745bfeafc49904b496089")
        self.assertEqual(cipher.encrypt_block(plain), encrypted)
        self.assertEqual(cipher.decrypt_block(encrypted), plain)

    def test_the_rfc_3394_vector_for_a_256_bit_key(self):
        plain = bytes.fromhex(
            "00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F"
        )
        wrapped = bytes.fromhex(
            "28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43B"
            "FB988B9B7A02DD21"
        )
        self.assertEqual(wrap_key(self.KEY, plain), wrapped)
        self.assertEqual(supervise.unwrap_key(self.KEY, wrapped), plain)

    def test_a_wrong_key_fails_the_unwrap(self):
        wrapped = wrap_key(self.KEY, os.urandom(32))
        self.assertIsNone(supervise.unwrap_key(b"\x01" * 32, wrapped))

    def test_cbc_carries_a_file_there_and_back(self):
        key = os.urandom(32)
        plain = b"CloudConfigurationDetails" * 7
        encrypted = supervise.aes_cbc_encrypt(key, supervise.add_padding(plain))
        self.assertEqual(len(encrypted) % 16, 0)
        self.assertEqual(supervise.strip_padding(supervise.aes_cbc_decrypt(key, encrypted)), plain)


class KeybagTest(unittest.TestCase):
    def setUp(self):
        self.class_keys = {2: os.urandom(32), 3: os.urandom(32), 4: os.urandom(32)}
        self.blob = build_keybag(PASSWORD, self.class_keys)

    def test_the_password_unwraps_every_class_key(self):
        keybag = supervise.Keybag(self.blob)
        self.assertEqual(sorted(keybag.class_keys), [2, 3, 4])
        self.assertEqual(keybag.attributes[b"ITER"], ROUNDS)
        self.assertEqual(keybag.attributes[b"UUID"], b"U" * 16)
        keybag.unlock(PASSWORD)
        for protection_class, class_key in self.class_keys.items():
            self.assertEqual(keybag.class_keys[protection_class][b"KEY"], class_key)

    def test_a_class_key_wraps_a_file_key_there_and_back(self):
        keybag = supervise.Keybag(self.blob)
        keybag.unlock(PASSWORD)
        file_key = os.urandom(32)
        wrapped = wrap_key(self.class_keys[3], file_key)
        self.assertEqual(keybag.unwrap_for_class(3, wrapped), file_key)

    def test_a_wrong_password_is_refused(self):
        keybag = supervise.Keybag(self.blob)
        with self.assertRaises(supervise.Refusal) as caught:
            keybag.unlock(OTHER_PASSWORD)
        self.assertIn("Wrong backup password", str(caught.exception))

    def test_a_keybag_without_the_second_stage_is_refused(self):
        keybag = supervise.Keybag(build_keybag(PASSWORD, self.class_keys, second_stage=False))
        with self.assertRaises(supervise.Refusal):
            keybag.unlock(PASSWORD)

    def test_an_unknown_class_is_refused(self):
        keybag = supervise.Keybag(self.blob)
        keybag.unlock(PASSWORD)
        with self.assertRaises(supervise.Refusal) as caught:
            keybag.unwrap_for_class(11, wrap_key(self.class_keys[2], os.urandom(32)))
        self.assertIn("protection class 11", str(caught.exception))


class EncryptedBackupTest(unittest.TestCase):
    plist_format = plistlib.FMT_XML
    content = CONTENT
    journal_mode = "delete"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.backup_dir = build_encrypted_backup(
            self.root, dict(self.content), self.plist_format, self.journal_mode
        )
        self.original = (self.backup_dir / FILE_ID[:2] / FILE_ID).read_bytes()
        self.manifest_original = (self.backup_dir / supervise.MANIFEST_DB_NAME).read_bytes()
        real_root = supervise.BACKUP_ROOT
        supervise.BACKUP_ROOT = self.root
        self.addCleanup(setattr, supervise, "BACKUP_ROOT", real_root)

    def run_command(self, *argv) -> str:
        output = io.StringIO()
        with redirect_stdout(output):
            code = supervise.main(list(argv))
        self.assertEqual(code, supervise.EXIT_OK, output.getvalue())
        return output.getvalue()

    def content_bytes(self) -> bytes:
        return (self.backup_dir / FILE_ID[:2] / FILE_ID).read_bytes()

    def manifest_bytes(self) -> bytes:
        return (self.backup_dir / supervise.MANIFEST_DB_NAME).read_bytes()

    def keys(self) -> supervise.BackupKeys:
        manifest = supervise.read_manifest_plist(self.backup_dir)
        return supervise.unlock_backup(manifest, PASSWORD)

    def plain_manifest(self) -> bytes:
        return supervise.aes_cbc_decrypt(self.keys().manifest, self.manifest_bytes())

    def manifest_row_size(self) -> int:
        """Decrypt Manifest.db by hand and read the recorded size with plain sqlite3."""
        with tempfile.TemporaryDirectory() as scratch:
            database = Path(scratch) / supervise.MANIFEST_DB_NAME
            database.write_bytes(self.plain_manifest())
            connection = sqlite3.connect(str(database))
            try:
                row = connection.execute(
                    "SELECT file FROM Files WHERE fileID = ?", (FILE_ID,)
                ).fetchone()
            finally:
                connection.close()
        return supervise.read_blob_size(bytes(row[0]))

    def stray_files(self) -> list:
        """Every plain copy and every sqlite journal left anywhere under the root."""
        return sorted(
            str(path.relative_to(self.root))
            for path in self.root.rglob("*")
            if path.name.startswith("manifest-") or path.name.endswith(("-wal", "-shm"))
        )


class LockedBackupTest(EncryptedBackupTest):
    def test_without_a_password_the_flag_is_unknown(self):
        backup = supervise.load_backup(self.backup_dir)
        self.assertTrue(backup.encrypted)
        self.assertIsNone(backup.keys)
        self.assertIsNone(backup.is_supervised)
        self.assertIn("--password", backup.note)
        self.assertIn("unknown", supervise.supervision_label(backup))

    def test_check_lists_the_backup_without_a_password(self):
        output = self.run_command("check")
        self.assertIn("Encrypted: yes", output)
        self.assertIn("IsSupervised: unknown", output)

    def test_check_reads_the_flag_with_a_password(self):
        output = self.run_command("check", "--password", PASSWORD, "--json")
        item = json.loads(output)["backups"][0]
        self.assertTrue(item["encrypted"])
        self.assertIs(item["is_supervised"], False)
        self.assertEqual(item["recorded_size"], len(plistlib.dumps(CONTENT, fmt=plistlib.FMT_XML)))

    def test_check_reads_the_password_from_the_environment(self):
        os.environ[supervise.PASSWORD_ENV] = PASSWORD
        self.addCleanup(os.environ.pop, supervise.PASSWORD_ENV, None)
        output = self.run_command("check")
        self.assertIn("IsSupervised: false", output)

    def test_a_wrong_password_is_refused(self):
        with self.assertRaises(supervise.Refusal) as caught:
            supervise.load_backup(self.backup_dir, OTHER_PASSWORD)
        self.assertIn("Wrong backup password", str(caught.exception))

    def test_the_plain_manifest_copy_does_not_stay_on_disk(self):
        supervise.load_backup(self.backup_dir, PASSWORD)
        folder = supervise.pristine_root(self.root)
        self.assertEqual(sorted(folder.glob("manifest-*")), [])


class PatchEncryptedTest(EncryptedBackupTest):
    def test_the_password_reads_the_supervision_file(self):
        backup = supervise.load_backup(self.backup_dir, PASSWORD)
        self.assertIs(backup.is_supervised, False)
        self.assertEqual(backup.file_id, FILE_ID)
        self.assertEqual(len(backup.keys.file), 32)
        self.assertEqual(len(supervise.read_content(backup)), backup.recorded_size)

    def test_patch_flips_the_flag_and_keeps_every_size(self):
        manifest_before = (self.backup_dir / supervise.MANIFEST_DB_NAME).read_bytes()
        output = self.run_command("patch", "--yes", "--password", PASSWORD)
        self.assertIn("Encryption:", output)
        self.assertIn("Manifest.db: no change.", output)

        self.assertEqual(len(self.content_bytes()), len(self.original))
        self.assertNotEqual(self.content_bytes(), self.original)
        self.assertEqual(
            (self.backup_dir / supervise.MANIFEST_DB_NAME).read_bytes(), manifest_before
        )

        patched = supervise.load_backup(self.backup_dir, PASSWORD)
        self.assertIs(patched.is_supervised, True)
        content = plistlib.loads(supervise.read_content(patched))
        self.assertIs(content["CloudConfigurationUIComplete"], True)
        self.assertIs(content["AllowPairing"], True)
        self.assertEqual(supervise.verify_patch(patched), patched.recorded_size)

    def test_unpatch_puts_back_the_encrypted_bytes(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        self.assertNotEqual(self.content_bytes(), self.original)
        self.run_command("unpatch", "--password", PASSWORD)
        self.assertEqual(self.content_bytes(), self.original)
        self.assertIs(supervise.load_backup(self.backup_dir, PASSWORD).is_supervised, False)

    def test_the_pristine_copy_holds_the_encrypted_file(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        saved = supervise.latest_pristine(self.root, UDID)
        self.assertEqual((saved / FILE_ID).read_bytes(), self.original)
        self.assertTrue((saved / supervise.MANIFEST_DB_NAME).is_file())


class BinaryEncryptedTest(EncryptedBackupTest):
    """A binary plist holds true and false once each, so this patch keeps the length."""

    plist_format = plistlib.FMT_BINARY
    content = dict(CONTENT, CloudConfigurationUIComplete=True, PostSetupProfileWasInstalled=False)

    def test_patch_keeps_the_length_of_a_binary_plist(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        self.assertEqual(len(self.content_bytes()), len(self.original))
        patched = supervise.load_backup(self.backup_dir, PASSWORD)
        self.assertIs(patched.is_supervised, True)


class ResizedEncryptedTest(EncryptedBackupTest):
    """Flipping both flags drops the last false, so this binary plist shrinks. The
    new length goes into Manifest.db, which is written again with the same key."""

    plist_format = plistlib.FMT_BINARY
    content = RESIZED_CONTENT
    restored_flag = False

    def test_the_plan_says_manifest_db_is_written_again(self):
        backup = supervise.load_backup(self.backup_dir, PASSWORD)
        plan = supervise.plan_patch(supervise.read_content(backup), backup.recorded_size)
        self.assertEqual(plan.plist_format, "binary")
        self.assertEqual(plan.padding, 0)
        self.assertIsNotNone(plan.new_recorded_size)
        self.assertNotEqual(plan.new_recorded_size, backup.recorded_size)
        self.assertIn(
            f"Manifest.db: re-encrypted with the new recorded size "
            f"({plan.new_recorded_size} bytes).",
            supervise.describe_plan(backup, plan),
        )

    def test_patch_records_the_new_size_in_the_encrypted_manifest(self):
        size_before = self.manifest_row_size()
        output = self.run_command("patch", "--yes", "--password", PASSWORD)
        self.assertIn("Manifest.db: re-encrypted with the new recorded size", output)
        self.assertNotEqual(self.manifest_bytes(), self.manifest_original)

        plain = supervise.read_content(supervise.load_backup(self.backup_dir, PASSWORD))
        self.assertIs(plistlib.loads(plain)["IsSupervised"], True)
        self.assertNotEqual(len(plain), size_before)
        self.assertEqual(self.manifest_row_size(), len(plain))

    def test_the_rewritten_manifest_is_one_sqlite_file(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        plain = self.plain_manifest()
        self.assertTrue(plain.startswith(b"SQLite format 3\x00"))
        self.assertEqual(len(plain) % 16, 0)
        # Bytes 18 and 19 hold the journal mode. One means a rollback journal,
        # so the one file carries everything the restore needs.
        self.assertEqual(plain[18:20], b"\x01\x01")
        self.assertEqual(self.stray_files(), [])

    def test_verify_agrees_with_the_rewritten_manifest(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        patched = supervise.load_backup(self.backup_dir, PASSWORD)
        self.assertIs(patched.is_supervised, True)
        self.assertEqual(supervise.verify_patch(patched), patched.recorded_size)

    def test_unpatch_puts_back_both_files(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        self.assertNotEqual(self.content_bytes(), self.original)
        self.assertNotEqual(self.manifest_bytes(), self.manifest_original)
        self.run_command("unpatch", "--password", PASSWORD)
        self.assertEqual(self.content_bytes(), self.original)
        self.assertEqual(self.manifest_bytes(), self.manifest_original)
        self.assertIs(
            supervise.load_backup(self.backup_dir, PASSWORD).is_supervised, self.restored_flag
        )
        self.assertEqual(self.stray_files(), [])

    def test_the_pristine_copy_holds_both_encrypted_files(self):
        self.run_command("patch", "--yes", "--password", PASSWORD)
        saved = supervise.latest_pristine(self.root, UDID)
        self.assertEqual((saved / FILE_ID).read_bytes(), self.original)
        self.assertEqual(
            (saved / supervise.MANIFEST_DB_NAME).read_bytes(), self.manifest_original
        )


class ResizedContentTest(unittest.TestCase):
    """The fixture has to hold the shape of the real file, or it tests nothing."""

    def test_the_binary_fixture_is_209_bytes_and_shrinks_on_the_patch(self):
        before = plistlib.dumps(dict(RESIZED_CONTENT), fmt=plistlib.FMT_BINARY)
        after = plistlib.dumps(
            dict(RESIZED_CONTENT, IsSupervised=True, CloudConfigurationUIComplete=True),
            fmt=plistlib.FMT_BINARY,
        )
        self.assertEqual(len(before), 209)
        self.assertLess(len(after), len(before))


class GrowingEncryptedTest(ResizedEncryptedTest):
    """The same rewrite the other way: a missing key makes the file grow."""

    content = {key: value for key, value in RESIZED_CONTENT.items() if key != "IsSupervised"}
    restored_flag = None


class WalEncryptedTest(ResizedEncryptedTest):
    """Manifest.db can sit in WAL mode. The rewrite has to fold the journal back
    into the one file, because the encrypted copy is one file and nothing else."""

    journal_mode = "wal"

    def test_the_fixture_starts_in_wal_mode(self):
        self.assertEqual(self.plain_manifest()[18:20], b"\x02\x02")

    def test_reading_the_backup_leaves_no_journal(self):
        supervise.load_backup(self.backup_dir, PASSWORD)
        self.assertEqual(self.stray_files(), [])


class ManifestDbTest(EncryptedBackupTest):
    def test_python_decrypts_the_manifest(self):
        keys = self.keys()
        encrypted = (self.backup_dir / supervise.MANIFEST_DB_NAME).read_bytes()
        plain = supervise.aes_cbc_decrypt(keys.manifest, encrypted)
        self.assertTrue(plain.startswith(b"SQLite format 3\x00"))

    @unittest.skipIf(shutil.which("openssl") is None, "openssl is missing")
    def test_openssl_decrypts_what_python_decrypts(self):
        keys = self.keys()
        database = self.backup_dir / supervise.MANIFEST_DB_NAME
        plain = supervise.decrypt_manifest_db(database, keys.manifest)
        try:
            self.assertEqual(
                plain.read_bytes(), supervise.aes_cbc_decrypt(keys.manifest, database.read_bytes())
            )
            self.assertEqual(plain.stat().st_mode & 0o777, 0o600)
        finally:
            supervise.remove_plain_db(plain)
        self.assertFalse(plain.exists())

    def test_the_manifest_comes_back_byte_for_byte(self):
        keys = self.keys()
        database = self.backup_dir / supervise.MANIFEST_DB_NAME
        plain = supervise.decrypt_manifest_db(database, keys.manifest)
        try:
            supervise.encrypt_manifest_db(plain, database, keys.manifest)
        finally:
            supervise.remove_plain_db(plain)
        self.assertEqual(self.manifest_bytes(), self.manifest_original)
        self.assertEqual(self.stray_files(), [])

    def test_python_encrypts_what_openssl_encrypts(self):
        keys = self.keys()
        database = self.backup_dir / supervise.MANIFEST_DB_NAME
        plain = supervise.decrypt_manifest_db(database, keys.manifest)
        try:
            with mock.patch.object(supervise.shutil, "which", return_value=None):
                supervise.encrypt_manifest_db(plain, database, keys.manifest)
        finally:
            supervise.remove_plain_db(plain)
        self.assertEqual(self.manifest_bytes(), self.manifest_original)

    def test_a_large_manifest_without_openssl_is_refused(self):
        backup = supervise.load_backup(self.backup_dir, PASSWORD)
        plan = supervise.PatchPlan(
            new_bytes=b"", plist_format="binary", old_size=209, new_recorded_size=201
        )
        with mock.patch.object(supervise.shutil, "which", return_value=None):
            with mock.patch.object(supervise, "PYTHON_MANIFEST_LIMIT", 1):
                with self.assertRaises(supervise.Refusal) as caught:
                    supervise.refuse_slow_manifest_rewrite(backup, plan)
        self.assertIn("openssl is missing", str(caught.exception))

    def test_a_length_that_aes_cannot_hold_is_refused(self):
        database = self.backup_dir / supervise.MANIFEST_DB_NAME
        odd = self.backup_dir / "odd.db"
        odd.write_bytes(b"SQLite format 3\x00" + b"x")
        with self.assertRaises(supervise.Refusal) as caught:
            supervise.encrypt_manifest_db(odd, database, self.keys().manifest)
        self.assertIn("AES cannot hold", str(caught.exception))
        self.assertEqual(self.manifest_bytes(), self.manifest_original)
        self.assertEqual(self.stray_files(), [])


if __name__ == "__main__":
    unittest.main()

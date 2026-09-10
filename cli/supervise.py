#!/usr/bin/env python3
"""Turn on iOS supervised mode without erasing the iPhone.

Apple's supported path to supervision erases the device. This tool flips the
IsSupervised flag inside an unencrypted Finder backup instead. You then restore
that backup in Finder and the iPhone comes back supervised with its data.

Python 3.12 or newer. Standard library only.
"""

import argparse
import json
import plistlib
import re
import shutil
import sqlite3
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

EXIT_OK = 0
EXIT_REFUSED = 1
EXIT_ERROR = 2

BACKUP_ROOT = Path.home() / "Library" / "Application Support" / "MobileSync" / "Backup"
SUPERVISION_DOMAIN = "SysSharedContainerDomain-systemgroup.com.apple.configurationprofiles"
SUPERVISION_RELATIVE_PATH = "Library/ConfigurationProfiles/CloudConfigurationDetails.plist"
PRISTINE_DIR_NAME = "keepyourattention-pristine"
PRISTINE_META_NAME = "pristine.json"
MANIFEST_DB_NAME = "Manifest.db"
MANIFEST_PLIST_NAME = "Manifest.plist"
CFGUTIL = Path("/Applications/Apple Configurator.app/Contents/MacOS/cfgutil")
ARCHIVE_SUFFIX = re.compile(r"\d+-\d+")

FULL_DISK_ACCESS_HELP = (
    "macOS blocked access to the backup folder.\n"
    "Give Full Disk Access to your terminal application:\n"
    "  1. Open System Settings, then Privacy & Security, then Full Disk Access.\n"
    "  2. Add your terminal application (Terminal, iTerm, Ghostty, or your editor).\n"
    "  3. Turn the switch on.\n"
    "  4. Quit the terminal application fully, then start it again.\n"
    "  5. Run this command again."
)

CFGUTIL_MISSING_HELP = (
    "Apple Configurator is not installed, so this tool cannot read the device state.\n"
    "Install it from the Mac App Store. Search for Apple Configurator.\n"
    "After the install, open Apple Configurator, then the menu Apple Configurator,\n"
    "then Install Automation Tools. This puts cfgutil in place.\n"
    "You can also check on the iPhone. Open Settings. The banner at the top says\n"
    "that this iPhone is supervised."
)


class Refusal(Exception):
    """A problem the user must fix. Prints a message and exits with code 1."""


@dataclass
class Backup:
    path: Path
    udid: str
    device_name: str
    ios_version: str
    date: str
    encrypted: bool
    file_id: str | None = None
    recorded_size: int | None = None
    is_supervised: bool | None = None
    note: str | None = None

    @property
    def manifest_db(self) -> Path:
        return self.path / MANIFEST_DB_NAME

    @property
    def content_path(self) -> Path:
        if self.file_id is None:
            raise Refusal("This backup has no supervision file.")
        return self.path / self.file_id[:2] / self.file_id

    @property
    def has_supervision_row(self) -> bool:
        return self.file_id is not None


@dataclass
class PatchPlan:
    new_bytes: bytes
    plist_format: str
    old_size: int
    padding: int = 0
    new_recorded_size: int | None = None
    changes: list[str] = field(default_factory=list)


def plist_value(value) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "missing"
    return str(value)


def count_label(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


# Reading a backup


def read_manifest_plist(backup_dir: Path) -> dict:
    with open(backup_dir / MANIFEST_PLIST_NAME, "rb") as handle:
        return plistlib.load(handle)


def read_supervision_row(backup_dir: Path) -> tuple[str, bytes] | None:
    """Return (fileID, archived file blob) for the supervision file, or None."""
    database = backup_dir / MANIFEST_DB_NAME
    if not database.exists():
        return None
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
    try:
        row = connection.execute(
            "SELECT fileID, file FROM Files WHERE domain = ? AND relativePath = ?",
            (SUPERVISION_DOMAIN, SUPERVISION_RELATIVE_PATH),
        ).fetchone()
    finally:
        connection.close()
    if row is None:
        return None
    return row[0], bytes(row[1])


def read_blob_size(blob: bytes) -> int:
    """Read the file size that Manifest.db records inside an NSKeyedArchiver blob."""
    archive = plistlib.loads(blob)
    for item in archive.get("$objects", []):
        if isinstance(item, dict) and "Size" in item:
            return int(item["Size"])
    raise Refusal("Manifest.db holds no Size value for the supervision file.")


def write_blob_size(blob: bytes, size: int) -> bytes:
    """Return a new NSKeyedArchiver blob with the recorded file size replaced."""
    archive = plistlib.loads(blob)
    for item in archive.get("$objects", []):
        if isinstance(item, dict) and "Size" in item:
            item["Size"] = size
            return plistlib.dumps(archive, fmt=plistlib.FMT_BINARY)
    raise Refusal("Manifest.db holds no Size value for the supervision file.")


def load_backup(backup_dir: Path) -> Backup:
    manifest = read_manifest_plist(backup_dir)
    lockdown = manifest.get("Lockdown") or {}
    date = manifest.get("Date")
    backup = Backup(
        path=backup_dir,
        udid=lockdown.get("UniqueDeviceID") or backup_dir.name,
        device_name=lockdown.get("DeviceName") or "unknown",
        ios_version=lockdown.get("ProductVersion") or "unknown",
        date=date.strftime("%Y-%m-%d %H:%M") if isinstance(date, datetime) else "unknown",
        encrypted=bool(manifest.get("IsEncrypted")),
    )
    if backup.encrypted:
        backup.note = "The backup is encrypted, so the supervision file cannot be read."
        return backup
    row = read_supervision_row(backup_dir)
    if row is None:
        backup.note = "The backup holds no supervision file row."
        return backup
    backup.file_id = row[0]
    backup.recorded_size = read_blob_size(row[1])
    if not backup.content_path.exists():
        backup.note = f"The supervision file is missing at {backup.content_path}."
        return backup
    try:
        content = plistlib.loads(backup.content_path.read_bytes())
    except (plistlib.InvalidFileException, ValueError):
        backup.note = "The supervision file is not a readable plist."
        return backup
    if not isinstance(content, dict):
        backup.note = "The supervision file is not a plist dictionary."
        return backup
    backup.is_supervised = content.get("IsSupervised")
    return backup


def backup_kind(backup: Backup) -> str:
    """Tell a live backup folder from a dated copy that Finder keeps beside it."""
    name = backup.path.name
    prefix = f"{backup.udid}-"
    if name.startswith(prefix) and ARCHIVE_SUFFIX.fullmatch(name[len(prefix):]):
        return "archive"
    return "current"


def find_backups(root: Path | None = None) -> list[Path]:
    root = BACKUP_ROOT if root is None else root
    if not root.exists():
        raise Refusal(
            f"There is no backup folder at {root}.\n"
            "Connect the iPhone, open Finder, select the device, and make a backup to this Mac."
        )
    return [
        child
        for child in sorted(root.iterdir())
        if child.is_dir() and (child / MANIFEST_PLIST_NAME).exists()
    ]


def load_backups(udid: str | None = None, root: Path | None = None) -> list[Backup]:
    backups = [load_backup(path) for path in find_backups(root)]
    if udid is None:
        return backups
    matches = [item for item in backups if udid in (item.udid, item.path.name)]
    if not matches:
        raise Refusal(f"There is no backup with UDID {udid}. Run the check command to list them.")
    return matches


def select_backup(udid: str | None = None, root: Path | None = None) -> Backup:
    root = BACKUP_ROOT if root is None else root
    backups = load_backups(udid, root)
    if not backups:
        raise Refusal(
            f"There are no backups in {root}.\n"
            "Connect the iPhone, open Finder, select the device, and make a backup to this Mac."
        )
    if len(backups) == 1:
        return backups[0]
    wanted = udid if udid is not None else backups[0].udid
    if all(item.udid == wanted for item in backups):
        # The archive copies carry the UDID of the backup they came from, so the
        # folder named after the UDID alone is the current backup.
        current = [item for item in backups if item.path.name == wanted]
        if len(current) == 1:
            print(
                f"This UDID has {count_label(len(backups), 'backup folder')}. "
                f"Using {current[0].path.name}, the current one. "
                "For an archive copy, run this command again with --udid <folder name>."
            )
            return current[0]
    raise Refusal(
        "This Mac holds more than one backup. Run the check command to list them, "
        "then run this command again with --udid <UDID>."
    )


# Patching


def plan_patch(original: bytes, recorded_size: int) -> PatchPlan:
    """Work out the new file bytes without writing anything."""
    is_binary = original.startswith(b"bplist00")
    plist_format = plistlib.FMT_BINARY if is_binary else plistlib.FMT_XML
    content = plistlib.loads(original)
    if not isinstance(content, dict):
        raise Refusal("The supervision file is not a plist dictionary.")

    plan = PatchPlan(
        new_bytes=b"",
        plist_format="binary" if is_binary else "xml",
        old_size=recorded_size,
    )
    if content.get("IsSupervised") is not True:
        plan.changes.append(f"IsSupervised: {plist_value(content.get('IsSupervised'))} -> true")
        content["IsSupervised"] = True
    if content.get("CloudConfigurationUIComplete") is False:
        plan.changes.append("CloudConfigurationUIComplete: false -> true")
        content["CloudConfigurationUIComplete"] = True

    new_bytes = plistlib.dumps(content, fmt=plist_format)
    if not is_binary and len(new_bytes) < recorded_size:
        # Whitespace after the root element stays valid XML, so the file keeps
        # the byte size that Manifest.db records and the database stays untouched.
        plan.padding = recorded_size - len(new_bytes)
        new_bytes += b"\n" * plan.padding
    plan.new_bytes = new_bytes
    if len(new_bytes) != recorded_size:
        plan.new_recorded_size = len(new_bytes)
    return plan


def describe_plan(backup: Backup, plan: PatchPlan) -> str:
    lines = [
        f"Backup: {backup.device_name}, iOS {backup.ios_version}, made {backup.date}",
        f"UDID: {backup.udid}",
        f"File: {backup.content_path}",
        f"Format: {plan.plist_format} plist",
        "Planned changes:",
    ]
    for change in plan.changes:
        lines.append(f"  {change}")
    new_size = len(plan.new_bytes)
    if plan.padding:
        lines.append(
            f"Size: {plan.old_size} bytes now, {new_size} bytes after the patch "
            f"({count_label(plan.padding, 'newline')} added as padding)."
        )
    else:
        lines.append(f"Size: {plan.old_size} bytes now, {new_size} bytes after the patch.")
    if plan.new_recorded_size is None:
        lines.append("Manifest.db: no change.")
    else:
        lines.append(f"Manifest.db: the recorded size becomes {plan.new_recorded_size} bytes.")
    return "\n".join(lines)


def save_pristine(backup: Backup) -> Path:
    """Copy the untouched supervision file and Manifest.db aside. Return the folder."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    pristine_dir = backup.path.parent / PRISTINE_DIR_NAME / f"{backup.udid}-{stamp}"
    pristine_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(backup.content_path, pristine_dir / backup.file_id)
    shutil.copy2(backup.manifest_db, pristine_dir / MANIFEST_DB_NAME)
    meta = {
        "udid": backup.udid,
        "backup_path": str(backup.path),
        "file_id": backup.file_id,
        "content_relative_path": f"{backup.file_id[:2]}/{backup.file_id}",
        "saved_at": stamp,
    }
    (pristine_dir / PRISTINE_META_NAME).write_text(json.dumps(meta, indent=2) + "\n")
    return pristine_dir


def update_recorded_size(backup: Backup, size: int) -> None:
    connection = sqlite3.connect(str(backup.manifest_db))
    try:
        row = connection.execute(
            "SELECT file FROM Files WHERE fileID = ?", (backup.file_id,)
        ).fetchone()
        if row is None:
            raise Refusal("The supervision row vanished from Manifest.db.")
        connection.execute(
            "UPDATE Files SET file = ? WHERE fileID = ?",
            (write_blob_size(bytes(row[0]), size), backup.file_id),
        )
        connection.commit()
    finally:
        connection.close()


def apply_patch(backup: Backup, plan: PatchPlan) -> None:
    backup.content_path.write_bytes(plan.new_bytes)
    if plan.new_recorded_size is not None:
        update_recorded_size(backup, plan.new_recorded_size)


def verify_patch(backup: Backup) -> int:
    """Re-read the patched backup. Return the byte size that both sides agree on."""
    content = plistlib.loads(backup.content_path.read_bytes())
    if content.get("IsSupervised") is not True:
        raise Refusal("Verification failed. IsSupervised is not true. Run the unpatch command.")
    row = read_supervision_row(backup.path)
    if row is None:
        raise Refusal("Verification failed. Manifest.db lost the supervision row.")
    recorded = read_blob_size(row[1])
    actual = backup.content_path.stat().st_size
    if recorded != actual:
        raise Refusal(
            f"Verification failed. The file is {actual} bytes but Manifest.db records "
            f"{recorded} bytes. Run the unpatch command."
        )
    return actual


def latest_pristine(backup_root: Path, udid: str) -> Path:
    root = backup_root / PRISTINE_DIR_NAME
    prefix = f"{udid}-"
    candidates = []
    if root.exists():
        candidates = sorted(
            child
            for child in root.iterdir()
            if child.is_dir() and child.name.startswith(prefix)
        )
    if not candidates:
        raise Refusal(f"There is no saved copy for UDID {udid} in {root}.")
    return candidates[-1]


def restore_pristine(backup: Backup) -> Path:
    pristine_dir = latest_pristine(backup.path.parent, backup.udid)
    meta = json.loads((pristine_dir / PRISTINE_META_NAME).read_text())
    shutil.copy2(pristine_dir / meta["file_id"], backup.path / meta["content_relative_path"])
    shutil.copy2(pristine_dir / MANIFEST_DB_NAME, backup.manifest_db)
    return pristine_dir


# Apple Configurator


def cfgutil_devices() -> list[dict]:
    result = subprocess.run(
        [str(CFGUTIL), "list"], capture_output=True, text=True, check=False
    )
    devices = []
    for line in result.stdout.splitlines():
        fields = {}
        for part in line.strip().split("\t"):
            key, separator, value = part.partition(":")
            if separator:
                fields[key.strip()] = value.strip()
        if "ECID" in fields:
            devices.append(fields)
    return devices


# Commands


def backup_as_dict(backup: Backup) -> dict:
    return {
        "path": str(backup.path),
        "folder": backup.path.name,
        "udid": backup.udid,
        "kind": backup_kind(backup),
        "device_name": backup.device_name,
        "ios_version": backup.ios_version,
        "date": backup.date,
        "encrypted": backup.encrypted,
        "supervision_row": backup.has_supervision_row,
        "is_supervised": backup.is_supervised,
        "recorded_size": backup.recorded_size,
        "note": backup.note,
    }


def print_backup(backup: Backup) -> None:
    print("")
    print(f"  UDID: {backup.udid}")
    print(f"  Folder: {backup.path.name}")
    kind = backup_kind(backup)
    print(f"  Kind: {'Finder archive copy' if kind == 'archive' else 'current'}")
    print(f"  Device: {backup.device_name}")
    print(f"  iOS: {backup.ios_version}")
    print(f"  Backup date: {backup.date}")
    print(f"  Encrypted: {'yes' if backup.encrypted else 'no'}")
    print(f"  Supervision file: {'found' if backup.has_supervision_row else 'not found'}")
    print(f"  IsSupervised: {plist_value(backup.is_supervised)}")
    if backup.note:
        print(f"  Note: {backup.note}")


def cmd_check(args) -> int:
    backups = load_backups(args.udid)
    if args.json:
        print(
            json.dumps(
                {
                    "backup_root": str(BACKUP_ROOT),
                    "backups": [backup_as_dict(item) for item in backups],
                },
                indent=2,
            )
        )
        return EXIT_OK
    if not backups:
        raise Refusal(
            f"There are no backups in {BACKUP_ROOT}.\n"
            "Connect the iPhone, open Finder, select the device, and make a backup to this Mac."
        )
    print(f"Backup folder: {BACKUP_ROOT}")
    print(f"Found {count_label(len(backups), 'backup')}.")
    for item in backups:
        print_backup(item)
    return EXIT_OK


def print_checklist(backup: Backup) -> None:
    print("")
    print("Now restore the backup in Finder:")
    print("  1. On the iPhone, turn off Stolen Device Protection.")
    print("     Settings, then Face ID & Passcode, then Stolen Device Protection.")
    print("  2. On the iPhone, turn off Find My iPhone.")
    print("     Settings, then your name, then Find My, then Find My iPhone.")
    print("  3. On the Mac, open Finder and select the iPhone in the sidebar.")
    print("     Click Restore Backup and pick this backup:")
    print(f"     {backup.device_name}, made {backup.date}.")
    print("  4. Wait for the restore and the reboot. Open Settings on the iPhone.")
    print("     The banner at the top must say that this iPhone is supervised.")
    print("  5. Turn Find My iPhone on again.")
    print("  6. Run the verify command:")
    print("     python3 cli/supervise.py verify")


def cmd_patch(args) -> int:
    backup = select_backup(args.udid)
    if backup.encrypted:
        raise Refusal(
            "This backup is encrypted, so this tool cannot read it.\n"
            "In Finder, select the iPhone and clear the checkbox Encrypt local backup.\n"
            "Click Back Up Now, wait for the new backup, then run this command again."
        )
    if not backup.has_supervision_row:
        raise Refusal(
            "This backup holds no supervision file.\n"
            "Make a full backup of the iPhone in Finder, then run this command again."
        )
    if not backup.content_path.exists():
        raise Refusal(
            f"The supervision file is missing at {backup.content_path}.\n"
            "The backup is incomplete. Make a new backup in Finder."
        )
    if backup.is_supervised is True:
        print("This backup already says that the iPhone is supervised. Nothing to change.")
        return EXIT_OK

    plan = plan_patch(backup.content_path.read_bytes(), backup.recorded_size)
    print(describe_plan(backup, plan))
    if not args.yes:
        print("")
        answer = input("Patch this backup? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Stopped. Nothing changed.")
            return EXIT_REFUSED

    pristine_dir = save_pristine(backup)
    print("")
    print(f"Saved the untouched files here: {pristine_dir}")
    apply_patch(backup, plan)
    size = verify_patch(backup)
    print(f"Patched. IsSupervised is true and the file is {size} bytes, as Manifest.db records.")
    print_checklist(backup)
    return EXIT_OK


def cmd_unpatch(args) -> int:
    backup = select_backup(args.udid)
    pristine_dir = restore_pristine(backup)
    print(f"Put back the files from {pristine_dir}")
    restored = load_backup(backup.path)
    print(f"IsSupervised is now {plist_value(restored.is_supervised)}.")
    return EXIT_OK


def cmd_verify(args) -> int:
    if not CFGUTIL.exists():
        print(CFGUTIL_MISSING_HELP)
        return EXIT_OK
    command = [str(CFGUTIL)]
    if args.ecid:
        command += ["-e", args.ecid]
    else:
        devices = cfgutil_devices()
        if not devices:
            raise Refusal(
                "Apple Configurator sees no device.\n"
                "Connect the iPhone with a cable, unlock it, and tap Trust on the iPhone."
            )
        if len(devices) > 1:
            print("Apple Configurator sees more than one device:")
            for device in devices:
                name = device.get("Name", "unknown")
                print(f"  ECID {device['ECID']}  {device.get('Type', 'device')}  {name}")
            raise Refusal("Run this command again with --ecid <ECID>.")
    command += ["get", "isSupervised"]

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    output = (result.stdout or "").strip()
    if result.returncode != 0:
        message = (result.stderr or "").strip() or output
        if message:
            print(message, file=sys.stderr)
        raise Refusal(
            "cfgutil could not read the device.\n"
            "Connect the iPhone with a cable, unlock it, and tap Trust on the iPhone."
        )
    print(f"cfgutil says: {output}")
    lowered = output.lower()
    if "true" in lowered:
        print("The iPhone is supervised.")
        return EXIT_OK
    if "false" in lowered:
        print("The iPhone is not supervised. The restore did not carry the flag.")
        return EXIT_REFUSED
    print("cfgutil gave no clear answer. Open Settings on the iPhone and read the top banner.")
    return EXIT_OK


def cmd_run(args) -> int:
    code = cmd_check(args)
    if code != EXIT_OK:
        return code
    print("")
    code = cmd_patch(args)
    if code != EXIT_OK:
        return code
    print("")
    input("Press Enter after the restore finishes and the iPhone starts again. ")
    return cmd_verify(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="supervise.py",
        description=(
            "Turn on iOS supervised mode without erasing the iPhone. "
            "The tool patches an unencrypted Finder backup. You restore that backup in Finder."
        ),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("check", help="List the local backups and their supervision state.")
    check.add_argument("--udid", help="Only look at the backup with this UDID.")
    check.add_argument("--json", action="store_true", help="Print machine readable output.")
    check.set_defaults(handler=cmd_check)

    patch = subparsers.add_parser("patch", help="Set IsSupervised to true in a backup.")
    patch.add_argument("--udid", help="Pick the backup with this UDID.")
    patch.add_argument("--yes", action="store_true", help="Do not ask for confirmation.")
    patch.set_defaults(handler=cmd_patch, json=False)

    unpatch = subparsers.add_parser("unpatch", help="Put back the untouched copies of a backup.")
    unpatch.add_argument("--udid", help="Pick the backup with this UDID.")
    unpatch.set_defaults(handler=cmd_unpatch, json=False)

    verify = subparsers.add_parser("verify", help="Ask the connected iPhone if it is supervised.")
    verify.add_argument("--ecid", help="Pick the device with this ECID.")
    verify.set_defaults(handler=cmd_verify, json=False)

    run = subparsers.add_parser("run", help="Run check, then patch, then verify.")
    run.add_argument("--udid", help="Pick the backup with this UDID.")
    run.add_argument("--yes", action="store_true", help="Do not ask for confirmation.")
    run.add_argument("--ecid", help="Pick the device with this ECID.")
    run.set_defaults(handler=cmd_run, json=False)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    as_json = getattr(args, "json", False)
    try:
        return args.handler(args)
    except Refusal as error:
        if as_json:
            print(json.dumps({"error": str(error)}, indent=2))
        else:
            print(str(error), file=sys.stderr)
        return EXIT_REFUSED
    except PermissionError:
        print(FULL_DISK_ACCESS_HELP, file=sys.stderr)
        return EXIT_REFUSED
    except sqlite3.OperationalError as error:
        if "unable to open database" in str(error):
            print(FULL_DISK_ACCESS_HELP, file=sys.stderr)
            return EXIT_REFUSED
        print(f"Unexpected database error: {error}", file=sys.stderr)
        return EXIT_ERROR
    except KeyboardInterrupt:
        print("")
        print("Stopped.", file=sys.stderr)
        return EXIT_REFUSED
    except Exception as error:  # noqa: BLE001 - report and exit with code 2
        print(f"Unexpected error: {error}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    sys.exit(main())

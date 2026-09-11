"""The built single file is what install.sh downloads, so it must run on its own."""

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CLI_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(CLI_ROOT))
sys.path.insert(0, str(CLI_ROOT / "src"))

import build_single  # noqa: E402
from supervise_iphone import __version__  # noqa: E402


class SingleFileTest(unittest.TestCase):
    def test_the_built_file_prints_the_version(self):
        with tempfile.TemporaryDirectory() as temp:
            target = build_single.build(Path(temp) / "supervise")
            result = subprocess.run(
                [str(target), "--version"], capture_output=True, text=True, check=True
            )
        self.assertEqual(result.stdout.strip(), f"supervise {__version__}")


if __name__ == "__main__":
    unittest.main()

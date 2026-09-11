#!/usr/bin/env python3
"""Thin shim, kept so a checkout still runs the tool with one command.

The code lives in the supervise_iphone package next to this file. Users install
the `supervise` command instead: see cli/README.md.
"""

import sys
from pathlib import Path

# Prefer the package in this checkout; fall back to an installed one.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from supervise_iphone.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())

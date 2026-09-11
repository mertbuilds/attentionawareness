"""Entry point for `python3 -m supervise_iphone`."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())

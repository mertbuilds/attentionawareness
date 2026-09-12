#!/bin/sh
# Installer for the supervise command.
#
# cli/install.sh and apps/web/public/install.sh hold the same script. The public
# copy is served at https://attentionawareness.com/install.sh, and Workers static
# assets need a real file, so it is a copy and not a symlink. Edit cli/install.sh,
# then run: cp cli/install.sh apps/web/public/install.sh
#
# The site serves the tool as well: the web build copies cli/dist/supervise to
# apps/web/public/supervise, so the download needs no public repository.
set -eu

# One edit here moves the download if the domain changes.
URL="https://attentionawareness.com/supervise"
BIN_DIR="$HOME/.local/bin"
TARGET="$BIN_DIR/supervise"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This tool runs on macOS. It patches a Finder backup, which only a Mac makes." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is missing. Install the Apple command line tools, then run this again:" >&2
  echo "  xcode-select --install" >&2
  exit 1
fi

mkdir -p "$BIN_DIR"
echo "Downloading supervise to $TARGET"
if ! curl -fsSL "$URL" -o "$TARGET.new"; then
  echo "The download failed. Check the network, then run this again." >&2
  rm -f "$TARGET.new"
  exit 1
fi
chmod +x "$TARGET.new"
mv "$TARGET.new" "$TARGET"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo ""
    echo "$BIN_DIR is not on your PATH. Add it for this terminal:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo "Keep it for new terminals:"
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
    echo ""
    ;;
esac

"$TARGET" --version

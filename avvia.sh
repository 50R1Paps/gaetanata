#!/usr/bin/env bash
# Avvia Gaetanata su macOS e Linux. Se manca un Node adatto, ne scarica uno
# portabile in .runtime/ (nessuna installazione di sistema, nessun permesso di amministratore).
set -euo pipefail
cd "$(dirname "$0")"

if [ "$(uname -s)" = Darwin ]; then
  if [ "${1:-}" = --hidden ]; then
    data_dir="${GAETANATA_DATA_DIR:-$PWD/data}"
    mkdir -p "$data_dir"
    log="$data_dir/avvio.log"
    exec >>"$log" 2>&1
    trap 'code=$?; if [ "$code" -ne 0 ]; then /usr/bin/osascript - "$log" <<'"'"'APPLESCRIPT'"'"'
on run argv
  display dialog ("Gaetanata non si avvia. Consulta il log: " & item 1 of argv) with title "Gaetanata" buttons {"OK"} default button "OK" with icon stop
end run
APPLESCRIPT
fi' EXIT
  fi
  bundle="$HOME/Applications/Gaetanata.app/Contents"
  mkdir -p "$bundle/MacOS" "$bundle/Resources"
  cp assets/gaetanata.icns "$bundle/Resources/gaetanata.icns"
  cat >"$bundle/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Gaetanata</string>
<key>CFBundleIdentifier</key><string>it.gaetanata.local</string>
<key>CFBundleName</key><string>Gaetanata</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>gaetanata.icns</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
  printf '#!/bin/bash\nexec /bin/bash %q --hidden\n' "$PWD/avvia.sh" >"$bundle/MacOS/Gaetanata"
  chmod +x "$bundle/MacOS/Gaetanata"
fi

open_setup() {
  /usr/bin/osascript - "$PWD/avvia.command" <<'APPLESCRIPT'
on run argv
  tell application "Terminal"
    activate
    do script quoted form of (item 1 of argv)
  end tell
end run
APPLESCRIPT
}

NODE_MAJOR="$(tr -d '[:space:]' < .nvmrc)"
RUNTIME_DIR=".runtime/node"

node_ok() {
  # node:sqlite without flags needs Node >= 22.13.
  "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' 2>/dev/null
}

pick_node() {
  if [ -z "${GAETANATA_FORCE_RUNTIME:-}" ] && command -v node >/dev/null 2>&1 && node_ok node; then
    command -v node
    return
  fi
  if [ -x "$RUNTIME_DIR/bin/node" ] && node_ok "$RUNTIME_DIR/bin/node"; then
    echo "$RUNTIME_DIR/bin/node"
    return
  fi
  if [ "$(uname -s)" = Darwin ] && [ "${1:-}" = --hidden ]; then
    return 10
  fi
  download_node >&2
  echo "$RUNTIME_DIR/bin/node"
}

download_node() {
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) echo "Sistema non supportato: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64 | amd64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) echo "Processore non supportato: $(uname -m)"; exit 1 ;;
  esac
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  echo "Scarico Node ${NODE_MAJOR} per ${os}-${arch} (solo la prima volta)..."
  sums="$(curl -fsSL "$base/SHASUMS256.txt")"
  line="$(printf '%s\n' "$sums" | grep -E " node-v[0-9.]+-${os}-${arch}\.tar\.gz$")"
  file="${line##* }"
  expected="${line%% *}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$base/$file" -o "$tmp/$file"
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$tmp/$file" | cut -d' ' -f1)"
  else
    actual="$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)"
  fi
  if [ "$actual" != "$expected" ]; then
    echo "Checksum di Node non valido: download corrotto, riprova."
    exit 1
  fi
  tar -xzf "$tmp/$file" -C "$tmp"
  rm -rf "$RUNTIME_DIR"
  mkdir -p "$(dirname "$RUNTIME_DIR")"
  mv "$tmp/${file%.tar.gz}" "$RUNTIME_DIR"
}

if [ "$(uname -s)" = Darwin ] && [ "${1:-}" = --hidden ]; then
  if NODE="$(pick_node --hidden)"; then
    :
  else
    code=$?
    if [ "$code" = 10 ]; then open_setup; exit 0; fi
    exit "$code"
  fi
  if "$NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts --check-setup; then
    :
  else
    code=$?
    if [ "$code" = 10 ]; then open_setup; exit 0; fi
    exit "$code"
  fi
  "$NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts
else
  NODE="$(pick_node)"
  exec "$NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts
fi

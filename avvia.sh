#!/usr/bin/env bash
# Avvia Gaetanata su macOS e Linux. Se manca un Node adatto, ne scarica uno
# portabile in .runtime/ (nessuna installazione di sistema, nessun permesso di amministratore).
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${GAETANATA_RESTART_PARENT:-}" ]; then
  echo ready > .aggiornamento/launcher-pronto
  while kill -0 "$GAETANATA_RESTART_PARENT" 2>/dev/null; do sleep 0.1; done
  unset GAETANATA_RESTART_PARENT
fi

if [ "$(uname -s)" = Darwin ]; then
  if [ "${1:-}" = --hidden ]; then
    data_dir="${GAETANATA_DATA_DIR:-$PWD/data}"
    mkdir -p "$data_dir"
    log="$data_dir/avvio.log"
    exec >"$log" 2>&1
    trap 'code=$?; if [ "$code" -ne 0 ]; then
    reason=$(grep -E "Error:|Errore|fallito|EADDRINUSE" "$log" | tail -n 1 || true)
    if [ -z "$reason" ]; then reason=$(grep -v "^[[:space:]]*$" "$log" | tail -n 1 || true); fi
    /usr/bin/osascript - "$log" "${reason:-Avvio fallito (codice $code).}" <<'"'"'APPLESCRIPT'"'"'
on run argv
  display dialog ("Gaetanata non si avvia." & return & item 2 of argv & return & "Log: " & item 1 of argv) with title "Gaetanata" buttons {"OK"} default button "OK" with icon stop
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
  "$1" -e 'const r=require("./package.json").engines?.node,m=typeof r==="string"&&/^>=(\d+)\.(\d+)\.(\d+)$/.exec(r);if(!m){console.error("engines.node deve essere nel formato >=X.Y.Z");process.exit(2)}const v=process.versions.node.split(".").map(Number);for(let i=0;i<3;i++){if(v[i]!==Number(m[i+1]))process.exit(v[i]>Number(m[i+1])?0:1)}' 
}

pick_node() {
  if [ -z "${GAETANATA_FORCE_RUNTIME:-}" ] && command -v node >/dev/null 2>&1; then
    if node_ok node; then command -v node; return; else code=$?; fi
    if [ "$code" = 2 ]; then return 2; fi
  fi
  if [ -x "$RUNTIME_DIR/bin/node" ]; then
    if node_ok "$RUNTIME_DIR/bin/node"; then echo "$RUNTIME_DIR/bin/node"; return; else code=$?; fi
    if [ "$code" = 2 ]; then return 2; fi
  fi
  if [ "$(uname -s)" = Darwin ] && [ "${1:-}" = --hidden ]; then
    return 10
  fi
  download_node >&2 || return 1
  if ! node_ok "$RUNTIME_DIR/bin/node"; then
    echo "Il Node portabile non soddisfa engines.node." >&2
    return 1
  fi
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
  sums="$(curl -fsSL "$base/SHASUMS256.txt")" || return 1
  line="$(printf '%s\n' "$sums" | grep -E " node-v[0-9.]+-${os}-${arch}\.tar\.gz$")" || return 1
  file="${line##* }"
  expected="${line%% *}"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$base/$file" -o "$tmp/$file" || return 1
  if command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$tmp/$file" | cut -d' ' -f1)"
  else
    actual="$(shasum -a 256 "$tmp/$file" | cut -d' ' -f1)"
  fi
  if [ "$actual" != "$expected" ]; then
    echo "Checksum di Node non valido: download corrotto, riprova."
    exit 1
  fi
  tar -xzf "$tmp/$file" -C "$tmp" || return 1
  mkdir -p "$(dirname "$RUNTIME_DIR")" || return 1
  rm -rf "$RUNTIME_DIR.previous"
  if [ -d "$RUNTIME_DIR" ]; then mv "$RUNTIME_DIR" "$RUNTIME_DIR.previous" || return 1; fi
  if ! mv "$tmp/${file%.tar.gz}" "$RUNTIME_DIR"; then
    if [ -d "$RUNTIME_DIR.previous" ]; then mv "$RUNTIME_DIR.previous" "$RUNTIME_DIR"; fi
    return 1
  fi
  rm -rf "$RUNTIME_DIR.previous"
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
  if NODE="$(pick_node)"; then
    :
  else
    code=$?
    if [ "${1:-}" = --resume-update ] && [ -x "${GAETANATA_PREVIOUS_NODE:-}" ]; then
      exec "$GAETANATA_PREVIOUS_NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts --rollback-update
    fi
    exit "$code"
  fi
  exec "$NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts "${1:-}"
fi

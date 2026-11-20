#!/usr/bin/env bash
# Avvia Gaetanata su macOS e Linux. Se manca un Node adatto, ne scarica uno
# portabile in .runtime/ (nessuna installazione di sistema, nessun permesso di amministratore).
set -euo pipefail
cd "$(dirname "$0")"

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

NODE="$(pick_node)"
exec "$NODE" --experimental-strip-types --disable-warning=ExperimentalWarning scripts/start.ts

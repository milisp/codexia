#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v jq >/dev/null 2>&1; then
  version="$(jq -r '.version' "${root_dir}/package.json")"
else
  version="$(node -e "console.log(require(process.argv[1]).version)" "${root_dir}/package.json")"
fi
os="${WEB_OS:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
arch="${WEB_ARCH:-$(uname -m)}"
libc=""
target_triple="${WEB_TARGET_TRIPLE:-}"

bin_ext=""
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) bin_ext=".exe" ;;
esac

case "${arch}" in
  amd64|x86_64) arch="x86_64" ;;
  arm64|aarch64) arch="aarch64" ;;
esac

if [[ "${os}" == "linux" ]]; then
  if [[ -n "${WEB_LIBC:-}" ]]; then
    libc="${WEB_LIBC}"
  else
    libc="gnu"
    if command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; then
      libc="musl"
    fi
  fi
fi

VITE_WEB_PORT="${VITE_WEB_PORT:-7420}" bun run build
cargo_args=(build --release --bin codexia-web)
if [[ -n "${target_triple}" ]]; then
  cargo_args+=(--target "${target_triple}")
fi
cargo "${cargo_args[@]}"

# step 4
stage_dir="/tmp/dist-web"
echo "==> [1/4] Cleaning and preparing staging directory: ${stage_dir}"
rm -rf "${stage_dir}"
mkdir -p "${stage_dir}"

echo "==> [2/4] Copying artifacts to staging directory..."
echo "    -> Copying frontend assets (dist/)"
cp -R "${root_dir}/dist" "${stage_dir}/dist"

bin_dir="${root_dir}/target/release"
if [[ -n "${target_triple}" ]]; then
  bin_dir="${root_dir}/target/${target_triple}/release"
fi
echo "    -> Copying binary from ${bin_dir}"
cp "${bin_dir}/codexia-web${bin_ext}" "${stage_dir}/codexia-web${bin_ext}"

# keke next to codexia-web is preferred over PATH and npx (see
# crates/acp/src/agents.rs), so the package runs the tested keke version.
if [[ -n "${KEKE_BIN:-}" ]]; then
  echo "    -> Bundling keke from ${KEKE_BIN}"
  cp "${KEKE_BIN}" "${stage_dir}/keke${bin_ext}"
fi

echo "    -> Generating start-server.sh"
cat > "${stage_dir}/start-server.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${script_dir}"
./codexia-web "$@"
EOF
chmod +x "${stage_dir}/start-server.sh"

# step 5
tar_name="codexia-web-${version}-${os}-${arch}.tar.gz"
if [[ -n "${libc}" ]]; then
  tar_name="codexia-web-${version}-${os}-${arch}-${libc}.tar.gz"
fi

echo "==> [3/4] Creating tarball: /tmp/${tar_name}"
echo "    -> Changing directory to ${stage_dir}"
echo "    -> Packing explicitly defined targets..."

tar -C "${stage_dir}" -czf "/tmp/${tar_name}" .

echo "==> [4/4] Package process completed successfully."
echo "Wrote /tmp/${tar_name}"

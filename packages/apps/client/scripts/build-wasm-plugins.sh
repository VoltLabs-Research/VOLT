#!/usr/bin/env bash
# Rebuilds the browser plugins served from public/wasm-plugins (used by /canvas/wasm), and the
# trajectory reader every file is opened with there (LammpsIO's browser build, lammpsio.js/.wasm).
#
#   scripts/build-wasm-plugins.sh            # every plugin and the reader
#   scripts/build-wasm-plugins.sh opendxa    # only the given binaries (`lammpsio` is the reader)
#
# Requires emsdk (sourced, or at $EMSDK / ~/emsdk), cmake and ninja.
set -euo pipefail

client_dir="$(cd "$(dirname "$0")/.." && pwd)"

# The plugin sources live in the ecosystem-level packages/ checkout (next to coretoolkit).
find_packages_dir() {
    local dir="$client_dir"
    while [[ "$dir" != "/" ]]; do
        dir="$(dirname "$dir")"
        if [[ -d "$dir/packages/coretoolkit" ]]; then
            echo "$dir/packages"
            return 0
        fi
    done
    return 1
}
packages_dir="${VOLT_PACKAGES_DIR:-$(find_packages_dir || true)}"
if [[ -z "$packages_dir" || ! -d "$packages_dir/coretoolkit" ]]; then
    echo "Plugin sources not found. Set VOLT_PACKAGES_DIR to the directory containing coretoolkit." >&2
    exit 1
fi
work_dir="${VOLT_WASM_WORK_DIR:-${TMPDIR:-/tmp}/volt-wasm-plugins}"
out_dir="$client_dir/public/wasm-plugins"
dist_dir="$work_dir/dist"

if ! command -v emcmake >/dev/null 2>&1; then
    emsdk_env="${EMSDK:-$HOME/emsdk}/emsdk_env.sh"
    if [[ ! -f "$emsdk_env" ]]; then
        echo "emsdk not found. Set EMSDK or source emsdk_env.sh." >&2
        exit 1
    fi
    # shellcheck disable=SC1090
    source "$emsdk_env" >/dev/null 2>&1
fi

si=structure-identification
cna=adaptive-common-neighbor-analysis
ptm=polyhedral-template-matching

# package dir | binary | dependency package dirs (in build order)
plugins=(
    "ackland-jones|ackland-jones|"
    "chill-plus|chill-plus|"
    "coordination-analysis|coordination-analysis|"
    "cluster-analysis|cluster-analysis|"
    "displacements-analysis|displacement-analysis|"
    "wigner-seitz-defect-analysis|wigner-seitz-defect-analysis|"
    "atomic-strain|atomic-strain|"
    "voronoi-analysis|voronoi-analysis|"
    "$cna|common-neighbor-analysis|$si"
    "$ptm|polyhedral-template-matching|$si $cna"
    "diamond-structure-identifier|identify-diamond|$si $cna"
    "pattern-structure-matcher|pattern-structure-matching|$si $cna"
    "elastic-strain|elastic-strain|$si"
    "opendxa|opendxa|$si"
    "reference-crystal-matching|reference-crystal-matching|$si"
    "grain-segmentation|grain-segmentation|$si $cna $ptm"
    "ILDA|ilda|$si $cna $ptm opendxa"
)

# Data the browser mounts under /plugin: binary | source dir (under packages/) | mount dir.
# Natively these live next to the executable ({{ analysis-entrypoint.projectPath }}).
plugin_data=(
    "opendxa|opendxa/lattices|share/volt/lattices"
    "elastic-strain|opendxa/lattices|share/volt/lattices"
    "reference-crystal-matching|reference-crystal-matching/structures|share/volt/structures"
    "pattern-structure-matching|pattern-structure-matcher/lattices|share/volt/lattices"
    "pattern-structure-matching|pattern-structure-matcher/resources/opendxa_lattices|share/volt/opendxa_lattices"
)

# Native builds find these directories through /proc/self/exe (or, for PSM, a Python wrapper);
# the browser runtime has neither, so pass them explicitly.
plugin_args=(
    "opendxa|--lattice_dir /plugin/share/volt/lattices"
    "elastic-strain|--lattice_dir /plugin/share/volt/lattices"
    "pattern-structure-matching|--lattice_dir /plugin/share/volt/lattices --reference_lattice_dir /plugin/share/volt/opendxa_lattices"
)

wanted=" $* "
mkdir -p "$dist_dir"

for entry in "${plugins[@]}"; do
    IFS='|' read -r package binary deps <<< "$entry"
    if (($#)) && [[ "$wanted" != *" $binary "* ]]; then
        continue
    fi

    dep_dirs=()
    for dep in $deps; do
        dep_dirs+=("$packages_dir/$dep")
    done

    echo "==> $binary"
    VOLT_WASM_BUILD_DIR="$work_dir/build" \
    VOLT_WASM_INSTALL_DIR="$work_dir/install" \
    VOLT_LAMMPSIO_SOURCE="$packages_dir/LammpsIO" \
        "$packages_dir/coretoolkit/scripts/build-wasm-plugin.sh" "$packages_dir/$package" "${dep_dirs[@]}"

    cp "$work_dir/install/bin/$binary.js" "$work_dir/install/bin/$binary.wasm" "$dist_dir/"
done

# The same C++ readers the cluster ingests uploads with: they decide from a file's contents whether
# it is a trajectory VOLT reads, and split it into frames.
if ((! $#)) || [[ "$wanted" == *" lammpsio "* ]]; then
    echo "==> lammpsio"
    reader_build_dir="$work_dir/lammpsio-reader"
    emcmake cmake -S "$packages_dir/LammpsIO" -B "$reader_build_dir" -G Ninja \
        -DCMAKE_BUILD_TYPE=Release -DLAMMPSIO_BUILD_WASM_READER=ON >/dev/null
    cmake --build "$reader_build_dir" --target lammpsio_wasm
    cp "$reader_build_dir/lammpsio.js" "$reader_build_dir/lammpsio.wasm" "$dist_dir/"
fi

# Manifests and data are cheap to copy, so refresh them for every plugin on each run.
rm -rf "$dist_dir/manifests" "$dist_dir/data"
mkdir -p "$dist_dir/manifests" "$dist_dir/data"
for entry in "${plugins[@]}"; do
    IFS='|' read -r package binary _ <<< "$entry"
    cp "$packages_dir/$package/plugin.json" "$dist_dir/manifests/$binary.json"
done
for data_entry in "${plugin_data[@]}"; do
    IFS='|' read -r binary source mount <<< "$data_entry"
    mkdir -p "$dist_dir/data/$binary/$mount"
    cp -r "$packages_dir/$source/." "$dist_dir/data/$binary/$mount/"
done

args_json="{}"
for args_entry in "${plugin_args[@]}"; do
    IFS='|' read -r args_binary args <<< "$args_entry"
    args_json="$(node -e 'const [map, key, args] = process.argv.slice(1); const parsed = JSON.parse(map); parsed[key] = args.split(" "); console.log(JSON.stringify(parsed));' "$args_json" "$args_binary" "$args")"
done

node - "$dist_dir" "$args_json" <<'EOF'
const fs = require('fs');
const path = require('path');
const [distDir, argsJson] = process.argv.slice(2);
const extraArgs = JSON.parse(argsJson);

const listFiles = (root, dir = '') => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((entry) => {
        const relative = path.posix.join(dir, entry.name);
        return entry.isDirectory() ? listFiles(root, relative) : [relative];
    });

const plugins = fs.readdirSync(path.join(distDir, 'manifests'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter((binary) => fs.existsSync(path.join(distDir, `${binary}.js`)))
    .sort()
    .map((binary) => {
        const dataDir = path.join(distDir, 'data', binary);
        return {
            binary,
            files: fs.existsSync(dataDir) ? listFiles(dataDir) : [],
            args: extraArgs[binary] ?? []
        };
    });

fs.writeFileSync(path.join(distDir, 'index.json'), `${JSON.stringify({ plugins }, null, 2)}\n`);
console.log(`index.json: ${plugins.length} plugins`);
EOF

rm -rf "$out_dir"
cp -r "$dist_dir" "$out_dir"
echo "Plugins copied to $out_dir"

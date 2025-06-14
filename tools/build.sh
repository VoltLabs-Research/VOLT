set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(realpath "${SCRIPT_DIR}/../")"
PYTHON_BINDINGS_DIR="${PROJECT_ROOT}/bindings/python"
DEPS_DIR="$(realpath "${SCRIPT_DIR}/../opendxa/dependencies/")"

PYTHON_CMD="python3"
PIP_CMD="pip"
PARALLEL_JOBS="$(nproc)"

clone_if_missing() {
    local repo_name="$1"
    local repo_url="$2"
    local target_dir="${DEPS_DIR}/${repo_name}"
    
    if [ -d "$target_dir" ]; then
        if [ -d "$target_dir/.git" ]; then
            echo "$repo_name already exists and is a valid Git repository"
            return 0
        else
            echo "$target_dir exists but is not a valid Git repository"
            echo "Deleting incomplete directory..."
            rm -rf "$target_dir"
        fi
    fi
    
    echo "Cloning $repo_name from $repo_url..."
    if git clone "$repo_url" "$target_dir"; then
        echo "$repo_name cloned successfully"
        return 0
    else
        echo "Error cloning $repo_name"
        return 1
    fi
}

install_deps(){
    echo "Checking C++ dependencies..."
    echo "Dependencies directory: $DEPS_DIR"

    if [ ! -d "$DEPS_DIR" ]; then
        echo "Creating dependency directory: $DEPS_DIR"
        mkdir -p "$DEPS_DIR"
    fi

    cd "$DEPS_DIR" || {
        echo "The dependencies directory could not be accessed"
        exit 1
    }

    declare -a dependencies=(
        "json|https://github.com/nlohmann/json.git"
        "cxxopts|https://github.com/jarro2783/cxxopts.git"
        "pybind11_json|https://github.com/pybind/pybind11_json.git"
    )

    local failed_clones=0
    local total_deps=${#dependencies[@]}

    echo "Checking $total_deps dependencies..."
    echo

    for dep in "${dependencies[@]}"; do
        IFS='|' read -r repo_name repo_url <<< "$dep"
        
        if ! clone_if_missing "$repo_name" "$repo_url"; then
            ((failed_clones++))
        fi
        echo
    done

    if [ $failed_clones -eq 0 ]; then
        echo "Tall facilities are available!"
        echo "Verified dependencies:"
        for dep in "${dependencies[@]}"; do
            IFS='|' read -r repo_name repo_url <<< "$dep"
            echo "  - $repo_name"
        done
    else
        echo "$failed_clones of $total_deps dependencies failed"
        exit 1
    fi

    echo
    echo "/opendxa/dependencies/ structure:"
    if command -v tree &> /dev/null; then
        tree "$DEPS_DIR" -L 2
    else
        ls -la "$DEPS_DIR"
    fi
}

install_deps

echo
echo "Python: $PYTHON_CMD"
echo "Jobs: $PARALLEL_JOBS"
echo

check_command(){
    if ! command -v "$1" &> /dev/null; then
        echo "ERROR: Command '$1' not found"
        exit 1
    fi
}

run_command(){
    echo ">>> $1"
    shift
    if ! "$@"; then
        echo "ERROR: Command failed"
        exit 1
    fi
}

# Check dependencies
check_command "$PYTHON_CMD"
check_command "gcc"

if [[ ! -d "$PYTHON_BINDINGS_DIR" ]]; then
    echo "ERROR: Python bindings directory not found: $PYTHON_BINDINGS_DIR"
    exit 1
fi

# Build C++ OpenDXA first
echo "=== Building C++ OpenDXA ==="
cd "$PROJECT_ROOT/opendxa"

if [[ ! -d "build" ]]; then
    mkdir build
fi

cd build

run_command "Configuring CMake" \
    cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_CXX_FLAGS="-O3 -march=native -fPIC" \
    -DCMAKE_C_FLAGS="-O3 -march=native -fPIC"

run_command "Building C++ OpenDXA" \
    make -j"$PARALLEL_JOBS"

echo "C++ OpenDXA build completed"
echo

# Build Python bindings
echo "=== Building Python Bindings ==="
cd "$PYTHON_BINDINGS_DIR"

run_command "Upgrading pip" \
    $PYTHON_CMD -m pip install --upgrade pip

# Install build dependencies FIRST
run_command "Installing build dependencies" \
    $PIP_CMD install --upgrade setuptools wheel pybind11 numpy

run_command "Cleaning previous builds" \
    $PYTHON_CMD setup.py clean --all 2>/dev/null || true

rm -rf build/ dist/ *.egg-info/ *.so __pycache__/ 2>/dev/null || true

# Use pip install instead of direct setup.py
run_command "Installing Python package" \
    $PIP_CMD install -e . --no-build-isolation

echo "Python bindings build completed"
echo
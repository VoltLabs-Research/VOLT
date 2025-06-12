set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(realpath "${SCRIPT_DIR}/../")"
PYTHON_BINDINGS_DIR="${PROJECT_ROOT}/bindings/python"

PYTHON_CMD="python3"
PIP_CMD="pip"
PARALLEL_JOBS="$(nproc)"

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
rm -rf opendxa/ 2>/dev/null || true

# Use pip install instead of direct setup.py
run_command "Installing Python package" \
    $PIP_CMD install -e . --no-build-isolation

echo "Python bindings build completed"
echo
BUILD_TYPE="Release"
BUILD_DIR="opendxa/build"
PARALLEL_JOBS=$(nproc)

check_dependencies(){
    echo "[INFO] Checking dependencies..."
    
    if ! command -v cmake &> /dev/null; then
        echo "[ERROR] CMake is not installed"
        exit 1
    fi
    
    if ! command -v make &> /dev/null; then
        echo "[ERROR] Make is not installed"
        exit 1
    fi
    
    if ! command -v g++ &> /dev/null && ! command -v clang++ &> /dev/null; then
        echo "[ERROR] No C++ compiler found (g++ or clang++)"
        exit 1
    fi
    
    bash tools/install_deps.sh

    echo "[SUCCESS] All dependencies found"
}

clean_build() {
    echo "[INFO] Cleaning build directory: $BUILD_DIR"
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        echo "[SUCCESS] Build directory cleaned"
    else
        echo "[WARNING] Build directory does not exist"
    fi
}

# Function to configure cmake
configure_cmake() {
    echo "[INFO] Configuring CMake with build type: $BUILD_TYPE"
    
    mkdir -p "$BUILD_DIR"
    cd "$BUILD_DIR"
    
    CMAKE_ARGS="-DCMAKE_BUILD_TYPE=$BUILD_TYPE"
    
    # Add debug-specific flags for better debugging
    if [ "$BUILD_TYPE" = "Debug" ]; then
        CMAKE_ARGS="$CMAKE_ARGS -DCMAKE_CXX_FLAGS_DEBUG=\"-g -O0 -Wall -Wextra -fsanitize=address -fno-omit-frame-pointer\""
        echo "[INFO] Debug mode: Added AddressSanitizer and extra debugging flags"
    fi
    
    # Since we're in opendxa/build, we need to point to the parent directory (opendxa/)
    cmake $CMAKE_ARGS ..
    
    if [ $? -ne 0 ]; then
        echo "[ERROR] CMake configuration failed"
        exit 1
    fi
    
    echo "[SUCCESS] CMake configuration completed"
}

build_project() {
    echo "[INFO] Building project with $PARALLEL_JOBS parallel jobs..."
    
    start_time=$(date +%s)
    
    make -j$PARALLEL_JOBS
    
    if [ $? -ne 0 ]; then
        echo "[ERROR] Build failed"
        exit 1
    fi
    
    end_time=$(date +%s)
    build_time=$((end_time - start_time))
    
    echo "[SUCCESS] Build completed in ${build_time}s"
}

case "${1:-}" in
    release|Release|RELEASE|"")
        BUILD_TYPE="Release"
        ;;
    debug|Debug|DEBUG)
        BUILD_TYPE="Debug"
        ;;
    clean|CLEAN)
        clean_build
        exit 0
        ;;
    *)
        echo "[ERROR] Unknown option: $1"
        exit 1
        ;;
esac

echo "[INFO] Starting OpenDXA build process..."
echo "[INFO] Build Type: $BUILD_TYPE"
echo "[INFO] Using $PARALLEL_JOBS parallel jobs"

if [ ! -f "opendxa/CMakeLists.txt" ]; then
    echo "[ERROR] opendxa/CMakeLists.txt not found. Please run this script from the project root directory."
    exit 1
fi

check_dependencies
configure_cmake
build_project

echo "[SUCCESS] Build process completed successfully!"
echo "[INFO] Executable location: $BUILD_DIR/opendxa"
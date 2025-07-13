set -euo pipefail

sudo apt-get install -y \
    build-essential \
    cmake \
    ninja-build \
    git \
    python3-dev \
    python3-pip \
    pybind11-dev \
    libeigen3-dev \
    libtbb-dev \
    libomp-dev \
    libspdlog-dev

DEPS_DIR="opendxa/dependencies"
mkdir -p "$DEPS_DIR"
cd "$DEPS_DIR"

if [ ! -d "json" ]; then
    echo "Downloading nlohmann-json..."
    git clone https://github.com/nlohmann/json.git json
    cd json
    git checkout v3.11.3
    cd ..
else
    echo "nlohmann-json already exists."
fi

if [ ! -d "pybind11_json" ]; then
    echo "Downloading pybind11_json..."
    git clone --depth 1 https://github.com/pybind/pybind11_json pybind11_json
else
    echo "pybind11_json already exists."
fi

if [ ! -d "boost" ]; then
    echo "Downloading Boost..."
    # TODO:
    git clone --depth 1 https://github.com/boostorg/boost.git boost
else
    echo "Boost already exists."
fi

cd ..
echo "Dependencies downloaded in the '$DEPS_DIR' directory."
echo "You can now run CMake."
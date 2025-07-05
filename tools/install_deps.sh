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

if [ ! -d "geogram" ]; then
    echo "Downloading Geogram and its submodules (full clone)..."
    git clone --recurse-submodules https://github.com/BrunoLevy/geogram.git geogram
else
    echo "Geogram already exists."
fi

if [ ! -d "pybind11" ]; then
    echo "Downloading pybind11..."
    git clone --depth 1 https://github.com/pybind/pybind11.git pybind11
else
    echo "pybind11 already exists."
fi

cd ..
echo "Dependencies downloaded in the '$DEPS_DIR' directory."
echo "You can now run CMake."
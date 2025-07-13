ZSTD_TARGET_DIR="client/wasm/zstd/dependencies"

mkdir -p "$ZSTD_TARGET_DIR"
cd "$ZSTD_TARGET_DIR"

if [ ! -d "zstd" ]; then
    echo "Downloading Zstandard..."
    git clone --depth 1 https://github.com/facebook/zstd.git zstd
else
    echo "Zstandard already exists."
fi
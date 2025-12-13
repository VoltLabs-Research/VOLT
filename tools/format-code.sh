# tools/format.sh [--check]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FORMATTER_DIR="$PROJECT_ROOT/volterra-formatter"


MODE=""
if [ "$1" == "--check" ]; then
    MODE="--check"
    echo "voltera-code-formatter: checking formatting..."
else
    echo "volterra-code-formatter: Formatting code..."
fi

FILES=$(find "$PROJECT_ROOT/server" "$PROJECT_ROOT/client/src" "$PROJECT_ROOT/desktop" \
    -type f \( -name "*.ts" -o -name "*.tsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/.git/*" \
    2>/dev/null | tr '\n' ' ')

cd "$FORMATTER_DIR" && npx tsx src/index.ts $MODE $FILES

echo ""
echo "volterra-code-formatter: ok!"
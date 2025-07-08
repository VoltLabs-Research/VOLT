from pathlib import Path
from typing import Any, Dict, Iterator, Union
import orjson

def load_analyses(
    source: Union[str, Path],
    pattern: str = "*.json"
) -> Iterator[Dict[str, Any]]:
    src = Path(source)
    if src.is_file():
        yield orjson.loads(src.read_bytes())
    else:
        for path in sorted(src.glob(pattern)):
            yield orjson.loads(path.read_bytes())

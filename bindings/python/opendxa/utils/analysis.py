from pathlib import Path
from typing import Any, Dict, Iterator, Union
import json

def load_analyses(
    source: Union[str, Path],
    pattern: str = "*.json"
) -> Iterator[Dict[str, Any]]:
    '''
    Generator that iterates over one or more .json files and returns
    each parsed analysis into a dict.

    :param source: Path to a .json file or directory
    :param pattern: Pattern for listing files (valid if source is dir)
    :yields: Each analysis as a Dict[str, Any]
    '''
    src = Path(source)
    if src.is_file():
        with src.open('r') as f:
            yield json.load(f)
    else:
        for path in sorted(src.glob(pattern)):
            with path.open('r') as f:
                yield json.load(f)
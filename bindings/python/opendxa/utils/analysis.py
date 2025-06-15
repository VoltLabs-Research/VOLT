from typing import Any, Dict
import json

def load_analysis(path: str) -> Dict[str, Any]:
    with open(path, 'r') as file:
        return json.load(file)
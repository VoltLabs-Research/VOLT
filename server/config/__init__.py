from pathlib import Path

DATA_DIR = Path('data')
TIMESTEPS_DIR = DATA_DIR / 'timesteps'
RESULTS_DIR = DATA_DIR / 'results'

DATA_DIR.mkdir(exist_ok=True)
TIMESTEPS_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

# TODO: DELETE THIS FROM HERE, temp solution
from typing import Dict, Any
uploaded_files: Dict[str, Dict[str, Any]] = {}
analysis_cache: Dict[str, Dict] = {}

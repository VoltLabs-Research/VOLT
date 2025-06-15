from pathlib import Path

DATA_DIR = Path('data')
TRAJECTORY_DIR = DATA_DIR / 'timesteps'
ANALYSIS_DIR = DATA_DIR / 'results'

DATA_DIR.mkdir(exist_ok=True)
TRAJECTORY_DIR.mkdir(exist_ok=True)
ANALYSIS_DIR.mkdir(exist_ok=True)

# TODO: DELETE THIS FROM HERE, temp solution
from typing import Dict, Any
uploaded_files: Dict[str, Dict[str, Any]] = {}
analysis_cache: Dict[str, Dict] = {}

from pathlib import Path

DATA_DIR = Path('data')
TRAJECTORY_DIR = DATA_DIR / 'timesteps'
ANALYSIS_DIR = DATA_DIR / 'analysis'

DATA_DIR.mkdir(exist_ok=True)
TRAJECTORY_DIR.mkdir(exist_ok=True)
ANALYSIS_DIR.mkdir(exist_ok=True)
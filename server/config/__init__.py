from pathlib import Path

DATA_DIR = Path('data')
TRAJECTORY_DIR = DATA_DIR / 'timesteps'
ANALYSIS_DIR = DATA_DIR / 'analysis'
COMPRESSED_DIR = DATA_DIR / 'compressed'
COMPRESSED_ANALYSIS_DIR = DATA_DIR / 'compressed'

DATA_DIR.mkdir(exist_ok=True)
TRAJECTORY_DIR.mkdir(exist_ok=True)
ANALYSIS_DIR.mkdir(exist_ok=True)
COMPRESSED_DIR.mkdir(exist_ok=True)
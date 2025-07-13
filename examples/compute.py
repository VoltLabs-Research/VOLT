from opendxa import DislocationAnalysis, StructureIdentification, compress_dump_to_zstd
from pathlib import Path
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
)

pipeline = DislocationAnalysis()

# Since we are using PTM, there is no need to specify the structure type of our simulation.
pipeline.set_identification_mode(StructureIdentification.PTM)

TRAJECTORY_DIR = '../debug-data/K/100K/'
ANALYSIS_DIR = '../debug-data/analysis/'
COMPRESSED_DIR = '../debug-data/compressed/'
OUTPUT_TEMPLATE = 'timestep_{}.json'

trajectory_files = [str(file.absolute()) for file in Path(TRAJECTORY_DIR).glob('*') if file.is_file()]

for trajectory_file in Path(TRAJECTORY_DIR).glob('*'):
    zst_file = Path(COMPRESSED_DIR) / (trajectory_file.stem + '.bin.zst')
    if not zst_file.exists():
        logging.info("Compressing %s → %s", trajectory_file.name, zst_file.name)
        compress_dump_to_zstd(str(trajectory_file), str(zst_file))


# pipeline.compute_trajectory(trajectory_files, OUTPUT_TEMPLATE)

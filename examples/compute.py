from opendxa import DislocationAnalysis, StructureIdentification, LatticeStructure
from pathlib import Path
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
)

pipeline = DislocationAnalysis()

# Since we are using PTM, there is no need to specify the structure type of our simulation.
pipeline.set_identification_mode(StructureIdentification.PTM)

TRAJECTORY_DIR = '../debug-data/Sigma9yz/'
ANALYSIS_DIR = '../debug-data/analysis/'
OUTPUT_TEMPLATE = 'timestep_{}.json'

trajectory_files = [str(file.absolute()) for file in Path(TRAJECTORY_DIR).glob('*') if file.is_file()]

pipeline.compute_trajectory(trajectory_files, OUTPUT_TEMPLATE)
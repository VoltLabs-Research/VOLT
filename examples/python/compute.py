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
pipeline.set_crystal_structure(LatticeStructure.BCC)

TRAJECTORY_DIR = '../debug-data/Sigma9yz/'
ANALYSIS_DIR = '../debug-data/analysis/'
COMPRESSED_DIR = '../debug-data/compressed/'
OUTPUT_TEMPLATE = 'timestep_{}.json'

# trajectory_files = [str(file.absolute()) for file in Path(TRAJECTORY_DIR).glob('*') if file.is_file()]
# pipeline.compute_trajectory(trajectory_files, OUTPUT_TEMPLATE)

pipeline.compute('/home/rodyherrera/OpenDXA/debug-data/Simulations/17nm_Strain_0/100K/dump.ensayo.0.config', "dump.indent.0.identation.5nm.300k.json")
from opendxa import DislocationAnalysis, StructureIdentification, LatticeStructure
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
)

analyzer = DislocationAnalysis()

# Since we are using PTM, there is no need to specify the structure type of our simulation.
analyzer.set_identification_mode(StructureIdentification.PTM)

analyzer.compute_trajectory(['/home/rodyherrera/Descargas/Sigma9yz/dump.ensayo.75000.config'], '{}')
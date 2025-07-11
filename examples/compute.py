from opendxa import DislocationAnalysis, StructureIdentification
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
)

analyzer = DislocationAnalysis()

# Since we are using PTM, there is no need to specify the structure type of our simulation.
# analyzer.set_crystal_structure(LatticeStructure.BCC)
analyzer.set_identification_mode(StructureIdentification.PTM)

analyzer.set_max_trial_circuit_size(14)
analyzer.set_circuit_stretchability(9)

analyzer.set_line_smoothing_level(1)
analyzer.set_line_point_interval(2.5)
analyzer.set_defect_mesh_smoothing_level(8)

analyzer.set_mark_core_atoms(False)
analyzer.set_only_perfect_dislocations(False)

analyzer.compute('debug-data/sigma.dump', 'debug-data/sigma-analysis.json')
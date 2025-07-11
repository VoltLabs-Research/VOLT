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

import os
base_dir = '/home/rodyherrera/Descargas/Sigma9yz'

# 2️⃣  Ruta completa de cada archivo dentro de base_dir
files = [
    os.path.join(base_dir, f)
    for f in os.listdir(base_dir)
    if os.path.isfile(os.path.join(base_dir, f)) and f.endswith('.config') and not f.startswith('.')
]

# 3️⃣  Patrón de salida absoluto
out_pattern = os.path.join(base_dir, 'debug-data', 'sigma-analysis_%d.json')

# 4️⃣  Asegúrate de que la carpeta 'debug-data' exista
os.makedirs(os.path.dirname(out_pattern), exist_ok=True)

# 5️⃣  ¡A rodar!
analyzer.compute_trajectory(files, out_pattern)

from ovito.io import import_file
from ovito.modifiers import DislocationAnalysisModifier

import ovito
import json
import numpy as np

ovito.enable_logging()

def burgers_similar(vector1, vector2, tolerance=1e-6):
    a = np.array(vector1, dtype=float)
    b = np.array(vector2, dtype=float)
    return (np.linalg.norm(a - b) < tolerance) or (np.linalg.norm(a + b) < tolerance)

def load_ovito_vectors(dump_path, frame):
    pipeline = import_file(dump_path)
    modifier = DislocationAnalysisModifier()
    modifier.input_crystal_structure = DislocationAnalysisModifier.Lattice.FCC
    pipeline.modifiers.append(modifier)
    data = pipeline.compute(frame)
    return [
        tuple(line.true_burgers_vector.tolist())
        for line in data.dislocations.lines
    ]

def load_opendxa_vectors(opendxa_ts_path):
    with open(opendxa_ts_path, 'r') as file:
        data = json.load(file)
    return [
        tuple(dislocation['fcc_matched_burgers'])
        for dislocation in data['dislocations']
    ]

def test_burgers_match(dump_path, opendxa_ts_path, frame):
    ovito_vectors = load_ovito_vectors(dump_path, frame)
    opendxa_vectors = load_opendxa_vectors(opendxa_ts_path)
    
    matches = []
    for i, ovito_vector in enumerate(ovito_vectors):
        for j, opendxa_vector in enumerate(opendxa_vectors):
            if burgers_similar(ovito_vector, opendxa_vector):
                matches.append((i, j))
    assert len(matches) > 0, 'No Burgers vector match found'

    ovito_matched = set(i for i, _ in matches)
    opendxa_matched = set(j for _, j in matches)
    print(f'OVITO detected {len(ovito_vectors)} vectors, of which {len(ovito_matched)} match with OpenDXA.')
    print(f'OpenDXA detected {len(opendxa_vectors)} vectors, of which {len(opendxa_matched)} match with OVITO.')

'''
test_burgers_match('/home/rodyherrera/Desktop/OpenDXA/analysis.lammpstrj', '/home/rodyherrera/Desktop/OpenDXA/dislocations/timestep_124000.json', 124000)
'''
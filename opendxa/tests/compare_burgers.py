from ovito.io import import_file
from ovito.modifiers import DislocationAnalysisModifier
from collections import defaultdict
from fractions import Fraction

import ovito
import json
import numpy as np
import matplotlib.pyplot as plt 

ovito.enable_logging()

def burgers_similar(vector_a, vector_b, tolerance=1e-6):
    """
    Returns True if vector_a ≈ vector_b or vector_a ≈ -vector_b within the given tolerance.
    This accounts for the fact that a Burgers vector and its negative represent the same dislocation line
    (same slip direction but opposite traversal).
    """
    arr_a = np.array(vector_a, dtype=float)
    arr_b = np.array(vector_b, dtype=float)
    return (np.linalg.norm(arr_a - arr_b) < tolerance) or (np.linalg.norm(arr_a + arr_b) < tolerance)

def to_miller_indices(vector_float, denom=6):
    """
    Converts a float vector (e.g., (0.1666667, -0.1666667, 0.3333333))
    to Miller indices simplified with denominator 'denom'.
    Returns a tuple (h, k, l) of integers. Useful to compare crystallographic directions
    without floating‐point noise.
    """
    fractions_list = [Fraction(component).limit_denominator(denom) for component in vector_float]
    return tuple(frac.numerator for frac in fractions_list)

def load_ovito_vectors(dump_path, frame_index):
    """
    Loads the LAMMPS trajectory with OVITO, applies DXA (assuming FCC structure),
    and returns a list of tuples (burgers_vector, line_id) for each detected dislocation line.
    """
    pipeline = import_file(dump_path)
    dxa_modifier = DislocationAnalysisModifier()
    dxa_modifier.input_crystal_structure = DislocationAnalysisModifier.Lattice.FCC
    pipeline.modifiers.append(dxa_modifier)
    data_collection = pipeline.compute(frame_index)

    result_list = []
    for dislocation_line in data_collection.dislocations.lines:
        burgers_vec = tuple(dislocation_line.true_burgers_vector.tolist())
        line_id = dislocation_line.id
        result_list.append((burgers_vec, line_id))
    return result_list

def load_opendxa_vectors(json_path):
    """
    Opens the OpenDXA JSON file and returns
    a list of tuples (burgers_vector, dislocation_id) for each detected dislocation.
    """
    with open(json_path, 'r') as json_file:
        json_data = json.load(json_file)

    result_list = []
    for dislocation in json_data['dislocations']:
        burgers_vec = tuple(dislocation['fcc_matched_burgers'])
        dislocation_id = dislocation.get('id', None)
        if dislocation_id is None:
            dislocation_id = len(result_list)
        result_list.append((burgers_vec, dislocation_id))
    return result_list

def test_burgers_match(dump_path, opendxa_json_path, frame_index):
    # [(vector_float, line_id), ...]
    ovito_data = load_ovito_vectors(dump_path, frame_index)
    # [(vector_float, dislocation_id), ...]
    opendxa_data = load_opendxa_vectors(opendxa_json_path)

    # { (h,k,l): [ovito_line_ids ...] }
    ovito_by_miller = defaultdict(list)
    for vector_float, line_id in ovito_data:
        miller = to_miller_indices(vector_float)
        ovito_by_miller[miller].append(line_id)

    # { (h,k,l): [opendxa_ids ...] }
    opendxa_by_miller = defaultdict(list)
    for vector_float, dislocation_id in opendxa_data:
        miller = to_miller_indices(vector_float)
        opendxa_by_miller[miller].append(dislocation_id)

    # Identify exact matches and opposite-sign matches
    # [(miller, ovito_ids, opendxa_ids)]
    exact_matches = []
    # [(miller, ovito_ids, opendxa_ids)]
    opposite_matches = []

    millers_ovito = set(ovito_by_miller.keys())
    millers_opendxa = set(opendxa_by_miller.keys())

    # a) Exact Miller matches (same [h k l])
    for miller in millers_ovito & millers_opendxa:
        exact_matches.append((miller, ovito_by_miller[miller], opendxa_by_miller[miller]))

    # b) Opposite-sign matches
    for miller in millers_ovito:
        opposite = (-miller[0], -miller[1], -miller[2])
        if opposite in millers_opendxa and miller not in (millers_ovito & millers_opendxa):
            opposite_matches.append((miller, ovito_by_miller[miller], opendxa_by_miller[opposite]))

    # Determine unmatched Miller directions
    matched_millers = {m for m, *_ in exact_matches} | {m for m, *_ in opposite_matches}
    opposite_of_matched = {(-m[0], -m[1], -m[2]) for m, *_ in opposite_matches}

    ovito_unmatched = [
        m for m in millers_ovito
        if m not in matched_millers and m not in opposite_of_matched
    ]
    opendxa_unmatched = [
        m for m in millers_opendxa
        if m not in matched_millers and m not in opposite_of_matched
    ]

    print('\nSummary:\n')

    print(f'- Total Burgers vectors detected:')
    print(f'   - OVITO:   {len(ovito_data)} vectors')
    print(f'   - OpenDXA: {len(opendxa_data)} vectors\n')

    print('- Exact Miller matches (same [h k l]):')
    print('   These represent dislocations where OVITO and OpenDXA report the identical crystallographic')
    print('   direction, e.g., [-1 1 -1]. Identical Miller indices mean both algorithms classify the')
    print('   same Burgers vector without ambiguity.\n')
    if exact_matches:
        for miller, ov_ids, op_ids in exact_matches:
            h, k, l = miller
            print(f'   • Miller [{h} {k} {l}]')
            print(f'     - OVITO line IDs:    {ov_ids}')
            print(f'     - OpenDXA IDs:       {op_ids}\n')
    else:
        print('   (No exact matches found)\n')

    print('- Opposite-sign matches ([h k l] ↔ [-h -k -l]):')
    print('   In crystallography, a Burgers vector and its negative represent the same dislocation line,')
    print('   because they differ only by traversal direction. We count these as valid matches,')
    print('   e.g., OVITO [1 -1 -1] versus OpenDXA [-1 1 1].\n')
    if opposite_matches:
        for miller, ov_ids, op_ids in opposite_matches:
            h, k, l = miller
            opp = (-h, -k, -l)
            print(f'   • OVITO Miller [{h} {k} {l}]  ≅  OpenDXA Miller [{opp[0]} {opp[1]} {opp[2]}]')
            print(f'     - OVITO line IDs:    {ov_ids}')
            print(f'     - OpenDXA IDs:       {op_ids}\n')
    else:
        print('   (No opposite-sign matches found)\n')

    print('- OVITO directions without any match in OpenDXA:')
    print('   These Burgers directions appear in OVITO output but OpenDXA does not report them,')
    print('   even considering opposite sign. This may indicate lines too short or classification differences.\n')
    if ovito_unmatched:
        for miller in ovito_unmatched:
            print(f'   • Miller [{miller[0]} {miller[1]} {miller[2]}] → OVITO line IDs: {ovito_by_miller[miller]}')
        print()
    else:
        print('   (All OVITO directions have at least one match)\n')

    print('- OpenDXA directions without any match in OVITO:')
    print('   These Burgers directions appear in OpenDXA JSON but OVITO did not report them. They may')
    print('   arise from dislocation segments OVITO treats as noise or slight rounding differences.\n')
    if opendxa_unmatched:
        for miller in opendxa_unmatched:
            print(f'   • Miller [{miller[0]} {miller[1]} {miller[2]}] → OpenDXA IDs: {opendxa_by_miller[miller]}')
        print()
    else:
        print('   (All OpenDXA directions have at least one match)\n')

    # 6) Final counts: how many unique line IDs match each direction
    ovito_matched_ids = set()
    opendxa_matched_ids = set()

    for _, ov_ids, op_ids in exact_matches:
        ovito_matched_ids.update(ov_ids)
        opendxa_matched_ids.update(op_ids)
    for _, ov_ids, op_ids in opposite_matches:
        ovito_matched_ids.update(ov_ids)
        opendxa_matched_ids.update(op_ids)

    num_ovito_present_in_opendxa = len(ovito_matched_ids)
    num_opendxa_present_in_ovito = len(opendxa_matched_ids)

    print('- FINAL COUNTS:')
    print(f'   - {num_ovito_present_in_opendxa} OVITO vectors are present in OpenDXA (exact or opposite).')
    print(f'   - {num_opendxa_present_in_ovito} OpenDXA vectors are present in OVITO (exact or opposite).\n')

    total_ovito_vectors = len(ovito_data)
    reliability_percent = (num_ovito_present_in_opendxa / total_ovito_vectors) * 100
    print('- RELIABILITY OF OPENDXA:')
    print('   This measures what fraction of OVITO Burgers vectors (considered ground truth)')
    print('   are detected by OpenDXA, counting both exact and opposite-sign matches.')
    print(f'   OpenDXA reliability: {reliability_percent:.2f}% of OVITO vectors found.\n')

# Example usage:
test_burgers_match(
    '/home/rodyherrera/Desktop/OpenDXA/analysis.lammpstrj',
    '/home/rodyherrera/Desktop/OpenDXA/dislocations/timestep_124000.json',
    124000
)
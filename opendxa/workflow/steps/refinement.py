from opendxa.classification import DislocationLineSmoother
from typing import List, Dict, Set, Any
from collections import defaultdict
import numpy as np
import logging

logger = logging.getLogger(__name__)

# TODO DUPLICATED CODE
class DislocationStatisticsGenerator:
    def __init__(self):
        self.tolerance = 0.1
    
    def generate_statistics(
        self,
        dislocation_lines: List[Dict],
        burgers_vectors: Dict[int, np.ndarray],
        core_atoms: Dict[str, set],
        system_volume: float
    ) -> Dict[str, Any]:
        burgers_families = self._classify_burgers_families(burgers_vectors)
        
        lengths = [line.get('length', 0) for line in dislocation_lines]
        total_length = sum(lengths)
        # Å to m
        total_length_m = total_length * 1e-10 
        
        # Å³ to m³
        system_volume_m3 = system_volume * 1e-30
        
        density_m_per_m3 = total_length_m / system_volume_m3 if system_volume_m3 > 0 else 0
        # m        
        box_side_length_m = (system_volume_m3) ** (1/3)
        # m²
        cross_sectional_area_m2 = box_side_length_m ** 2
        line_density_per_m2 = len(dislocation_lines) / cross_sectional_area_m2 if cross_sectional_area_m2 > 0 else 0
        
        statistics = {
            'total_dislocations': len(dislocation_lines),
            'total_length_angstrom': total_length,
            'total_length_meters': total_length_m,
            'average_length_angstrom': np.mean(lengths) if lengths else 0,
            'system_volume_angstrom3': system_volume,
            'system_volume_m3': system_volume_m3,
            'dislocation_density_m_per_m3': density_m_per_m3,
            'line_density_per_m2': line_density_per_m2,
            'burgers_families': burgers_families,
            'atom_counts': {
                'core_atoms': len(core_atoms.get('core_atoms', set())),
                'perfect_atoms': len(core_atoms.get('perfect_atoms', set()))
            }
        }
        
        logger.info(f'Statistics: {statistics["total_dislocations"]} dislocations')
        logger.info(f'Total length: {total_length:.1f} Å ({total_length_m:.2e} m)')
        logger.info(f'Volume: {system_volume:.1f} Å³ ({system_volume_m3:.2e} m³)')
        logger.info(f'Density: {density_m_per_m3:.2e} m/m³, {line_density_per_m2:.2e} lines/m²')
        
        return statistics
    
    def _classify_burgers_families(
        self, 
        burgers_vectors: Dict[int, np.ndarray]
    ) -> Dict[str, Dict]:
        families = defaultdict(lambda: {'count': 0, 'total_length': 0, 'vectors': []})
        
        for idx, burgers in burgers_vectors.items():
            magnitude = np.linalg.norm(burgers)
            if magnitude < 0.1:
                family = 'zero'
                # Shockley partials: a/6<112>
            elif magnitude < 1.5: 
                family = 'partial'
            elif 2.0 <= magnitude <= 4.0:
                # Perfect dislocations: a/2<110>
                family = 'perfect'
            elif magnitude > 4.0:
                family = f'extended_{magnitude:.1f}'
            else:
                family = f'intermediate_{magnitude:.1f}'
            
            families[family]['count'] += 1
            families[family]['vectors'].append(burgers.tolist())
            
            if 'avg_magnitude' not in families[family]:
                families[family]['avg_magnitude'] = magnitude
            else:
                count = families[family]['count']
                families[family]['avg_magnitude'] = (
                    (families[family]['avg_magnitude'] * (count - 1) + magnitude) / count
                )
        
        return dict(families)
    
def mark_core_atoms(
    core_radius: float,
    dislocation_lines: List[List[int]],
    positions: np.ndarray,
    burgers_vectors: Dict[int, np.ndarray]
) -> Dict[str, Set[int]]:
    core_atoms = set()
    
    for line_idx, line_atoms in enumerate(dislocation_lines):
        burgers_mag = np.linalg.norm(burgers_vectors.get(line_idx, np.zeros(3)))
        effective_radius = core_radius * (1 + burgers_mag)
        
        core_atoms.update(line_atoms)
        
        line_positions = positions[line_atoms]
        for atom_id, pos in enumerate(positions):
            min_dist = min(np.linalg.norm(pos - line_pos) for line_pos in line_positions)
            if min_dist <= effective_radius:
                core_atoms.add(atom_id)
    
    all_atoms = set(range(len(positions)))
    perfect_atoms = all_atoms - core_atoms
    
    logger.info(f'Core atoms: {len(core_atoms)}, Perfect atoms: {len(perfect_atoms)}')
    
    return {
        'core_atoms': core_atoms,
        'perfect_atoms': perfect_atoms
    }

def step_refine_lines(ctx, lines, filtered):
    args = ctx['args']
    data = ctx['data']
    
    # Core marking
    dislocation_lines = [line['atoms'] for line in lines]
    burgers_vectors = {i: line['burgers_vector'] for i, line in enumerate(lines)}
    
    core_classification = mark_core_atoms(
        core_radius=args.core_radius,
        dislocation_lines=dislocation_lines,
        positions=filtered['positions'],
        burgers_vectors=burgers_vectors
    )
    
    # Line smoothing
    smoother = DislocationLineSmoother(
        smoothing_level=args.line_smoothing_level,
        point_interval=args.line_point_interval
    )
    
    smoothed_positions = smoother.smooth_lines(
        dislocation_lines=dislocation_lines,
        positions=filtered['positions']
    )
    
    # Combine results
    refined_lines = []
    for i, line in enumerate(lines):
        refined_line = line.copy()
        refined_line['smoothed_positions'] = smoothed_positions[i]
        refined_lines.append(refined_line)
    
    # Calculate comprehensive statistics
    box = np.array(data['box'])
    volume = np.prod(box[:, 1] - box[:, 0])
    
    stats_generator = DislocationStatisticsGenerator()
    statistics = stats_generator.generate_statistics(
        dislocation_lines=refined_lines,
        burgers_vectors=burgers_vectors,
        core_atoms=core_classification,
        system_volume=volume
    )
    
    # Compute Nye tensor
    positions = filtered['positions']
    tensor = np.zeros((3, 3), dtype=np.float32)
    for i, b in burgers_vectors.items():
        loop = dislocation_lines[i]
        if len(loop) < 2:
            continue
        start = positions[loop[0]]
        end = positions[loop[-1]]
        lvec = end - start
        length = np.linalg.norm(lvec)
        if length > 0:
            direction = lvec / length
            tensor += np.outer(b, direction) * (1.0 / volume)
    
    statistics['nye_tensor'] = tensor
    statistics['nye_tensor_units'] = 'Å⁻¹'
    
    # Generate summary report
    magnitudes = [np.linalg.norm(b) for b in burgers_vectors.values()]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    
    if magnitudes:
        min_mag = np.min(magnitudes)
        max_mag = np.max(magnitudes)
        std_mag = np.std(magnitudes)
        ctx['logger'].info(f'Burgers magnitudes: min={min_mag:.3f}, max={max_mag:.3f}, '
                          f'mean={mean_mag:.3f}, std={std_mag:.3f} Å')
    
    statistics['summary'] = {
        'count': len(refined_lines),
        'avg_burgers_magnitude': mean_mag,
        'min_burgers_magnitude': np.min(magnitudes) if magnitudes else 0.0,
        'max_burgers_magnitude': np.max(magnitudes) if magnitudes else 0.0,
        'std_burgers_magnitude': np.std(magnitudes) if magnitudes else 0.0,
        'total_core_atoms': len(core_classification["core_atoms"])
    }
    
    ctx['logger'].info(f'Line refinement: {len(core_classification["core_atoms"])} core atoms, {len(refined_lines)} smoothed lines')
    ctx['logger'].info(f'Statistics: {len(refined_lines)} lines, avg Burgers: {mean_mag:.4f}')
    ctx['logger'].info(f"Nye tensor computed:\n{tensor}")
    
    return {
        'refined_lines': refined_lines,
        'core_atoms': core_classification,
        'statistics': statistics
    }
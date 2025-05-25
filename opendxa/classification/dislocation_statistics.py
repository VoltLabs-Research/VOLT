import numpy as np
from typing import Dict, List, Any
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

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
        
        box_side_length_m = (system_volume_m3) ** (1/3)  # m
        cross_sectional_area_m2 = box_side_length_m ** 2  # m²
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
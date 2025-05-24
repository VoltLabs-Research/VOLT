from typing import Dict, List, Tuple, Optional
from numba import jit
import numpy as np
import logging

logger = logging.getLogger(__name__)

class ElasticMapper:
    IDEAL_BURGERS = {
        'fcc': {
            'perfect': np.array([
                [0.5, 0.5, 0.0], [0.5, -0.5, 0.0], [0.5, 0.0, 0.5],
                [0.5, 0.0, -0.5], [0.0, 0.5, 0.5], [0.0, 0.5, -0.5],
                [-0.5, 0.5, 0.0], [-0.5, -0.5, 0.0], [-0.5, 0.0, 0.5],
                [-0.5, 0.0, -0.5], [0.0, -0.5, 0.5], [0.0, -0.5, -0.5]
            ]),
            'partial': np.array([
                [1/6, 1/6, 1/3], [1/6, -1/6, 1/3], [1/6, 1/6, -1/3],
                [1/6, -1/6, -1/3], [-1/6, 1/6, 1/3], [-1/6, -1/6, 1/3],
                [-1/6, 1/6, -1/3], [-1/6, -1/6, -1/3]
            ])
        },
        'bcc': {
            'perfect': np.array([
                [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5],
                [0.5, -0.5, -0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5],
                [-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5]
            ])
        }
    }
    
    def __init__(self, crystal_type: str = 'fcc', lattice_parameter: float = 1.0, tolerance: float = 0.3):
        self.crystal_type = crystal_type
        self.lattice_param = lattice_parameter
        self.tolerance = tolerance
        self.ideal_vectors = {}
        for b_type, vectors in self.IDEAL_BURGERS[crystal_type].items():
            self.ideal_vectors[b_type] = vectors * lattice_parameter
    
    def map_edge_burgers(
        self, 
        edge_vectors: Dict[Tuple[int, int], np.ndarray],
        displacement_field: Dict[int, np.ndarray]
    ) -> Dict[Tuple[int, int], np.ndarray]:
        edge_burgers = {}
        mapping_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0}
        
        for edge, edge_vector in edge_vectors.items():
            atom1, atom2 = edge
            
            disp1 = displacement_field.get(atom1, np.zeros(3))
            disp2 = displacement_field.get(atom2, np.zeros(3))
            displacement_jump = disp2 - disp1
            
            best_burgers, b_type = self._find_closest_ideal_burgers(displacement_jump)
            
            if best_burgers is not None:
                edge_burgers[edge] = best_burgers
                mapping_stats[b_type] += 1
            else:
                edge_burgers[edge] = displacement_jump
                mapping_stats['unmapped'] += 1
        
        logger.info(f'Elastic mapping: {mapping_stats}')
        return edge_burgers
    
    def _find_closest_ideal_burgers(
        self, 
        displacement_jump: np.ndarray
    ) -> Tuple[Optional[np.ndarray], str]:
        min_distance = float('inf')
        best_burgers = None
        best_type = 'unmapped'
        
        for ideal_vector in self.ideal_vectors['perfect']:
            distance = np.linalg.norm(displacement_jump - ideal_vector)
            if distance < min_distance and distance < self.tolerance:
                min_distance = distance
                best_burgers = ideal_vector.copy()
                best_type = 'perfect'
        
        if 'partial' in self.ideal_vectors:
            for ideal_vector in self.ideal_vectors['partial']:
                distance = np.linalg.norm(displacement_jump - ideal_vector)
                if distance < min_distance and distance < self.tolerance:
                    min_distance = distance
                    best_burgers = ideal_vector.copy()
                    best_type = 'partial'
        
        return best_burgers, best_type
    
    def compute_edge_vectors(
        self, connectivity: Dict[int, set], 
        positions: np.ndarray
    ) -> Dict[Tuple[int, int], np.ndarray]:
        edge_vectors = {}
        
        for atom1, neighbors in connectivity.items():
            for atom2 in neighbors:
                if atom1 < atom2:
                    vector = positions[atom2] - positions[atom1]
                    edge_vectors[(atom1, atom2)] = vector
        
        return edge_vectors
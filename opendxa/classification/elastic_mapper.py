from typing import Dict, List, Tuple, Optional
from opendxa.utils.pbc import compute_minimum_image_distance
from opendxa.utils.cuda import elastic_mapping_gpu
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
        },
        'hcp': {
            'perfect': np.array([
                # <10-10> type vectors - perfect dislocations in HCP
                [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0],  # [10-10] and [-1010]
                [-0.5, np.sqrt(3)/2, 0.0], [0.5, -np.sqrt(3)/2, 0.0],  # [-1100] and [1-100]
                [-0.5, -np.sqrt(3)/2, 0.0], [0.5, np.sqrt(3)/2, 0.0],  # [-1-110] and [1110]
                # <0001> type vectors
                [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]  # [0001] and [000-1]
            ]),
            'partial': np.array([
                # <10-10>/3 type vectors - partial dislocations in HCP
                [1/3, 0.0, 0.0], [-1/3, 0.0, 0.0],  # [10-10]/3 and [-1010]/3
                [-1/6, np.sqrt(3)/6, 0.0], [1/6, -np.sqrt(3)/6, 0.0],  # [-1100]/3 and [1-100]/3
                [-1/6, -np.sqrt(3)/6, 0.0], [1/6, np.sqrt(3)/6, 0.0],  # [-1-110]/3 and [1110]/3
                # <0001>/3 type vectors
                [0.0, 0.0, 1/3], [0.0, 0.0, -1/3]  # [0001]/3 and [000-1]/3
            ])
        }
    }
    
    def __init__(
        self, 
        crystal_type: str = 'fcc', 
        lattice_parameter: float = 1.0, 
        tolerance: float = 0.3, 
        box_bounds: Optional[np.ndarray] = None,
        pbc: List[bool] = [True, True, True]
    ):
        self.crystal_type = crystal_type
        self.lattice_param = lattice_parameter
        self.tolerance = tolerance
        self.box_bounds = box_bounds
        self.pbc = pbc
        self.ideal_vectors = {}
        for b_type, vectors in self.IDEAL_BURGERS[crystal_type].items():
            self.ideal_vectors[b_type] = vectors * lattice_parameter
        
        logger.info(f'ElasticMapper initialized:')
        logger.info(f'  Crystal type: {crystal_type}')
        logger.info(f'  Lattice parameter: {lattice_parameter:.6f}')
        logger.info(f'  Tolerance: {tolerance:.6f}')
        logger.info(f'  Perfect vectors (first 3): {self.ideal_vectors['perfect'][:3]}')
        if 'partial' in self.ideal_vectors:
            logger.info(f'  Partial vectors (first 3): {self.ideal_vectors['partial'][:3]}')

    def map_edge_burgers(
        self, 
        edge_vectors: Dict[Tuple[int, int], np.ndarray],
        displacement_field: Dict[int, np.ndarray]
    ) -> Dict[Tuple[int, int], np.ndarray]:
        """Map edge vectors to Burgers vectors with GPU acceleration when available"""
        
        # Compute displacement jumps
        displacement_jumps = {}
        for edge in edge_vectors.keys():
            atom1, atom2 = edge
            disp1 = displacement_field.get(atom1, np.zeros(3))
            disp2 = displacement_field.get(atom2, np.zeros(3))
            
            # Handle both single vectors and arrays of vectors
            if isinstance(disp1, np.ndarray) and disp1.ndim > 1:
                disp1 = np.mean(disp1, axis=0)  # Average if multiple displacement vectors
            if isinstance(disp2, np.ndarray) and disp2.ndim > 1:
                disp2 = np.mean(disp2, axis=0)
                
            displacement_jumps[edge] = disp2 - disp1
        
        if len(displacement_jumps) > 1000:
            edge_burgers, mapping_stats = elastic_mapping_gpu(
                displacement_jumps, self.ideal_vectors, self.tolerance
            )
            return edge_burgers
        
        edge_burgers = {}
        mapping_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0}
        
        for edge, displacement_jump in displacement_jumps.items():
            best_burgers, b_type = self._find_closest_ideal_burgers(displacement_jump)
            
            if best_burgers is not None:
                edge_burgers[edge] = best_burgers
                mapping_stats[b_type] += 1
            else:
                edge_burgers[edge] = displacement_jump
                mapping_stats['unmapped'] += 1
        
        return edge_burgers
    
    def _find_closest_ideal_burgers(
        self, 
        displacement_jump: np.ndarray
    ) -> Tuple[Optional[np.ndarray], str]:
        min_distance = float('inf')
        best_burgers = None
        best_type = 'unmapped'
        
        # Debug logging for first few edges
        if hasattr(self, '_debug_count'):
            self._debug_count += 1
        else:
            self._debug_count = 1
            
        if self._debug_count <= 5:
            logger.debug(f"Debug edge {self._debug_count}:")
            logger.debug(f"  Displacement jump: {displacement_jump}")
            logger.debug(f"  Magnitude: {np.linalg.norm(displacement_jump):.6f}")
            logger.debug(f"  Tolerance: {self.tolerance:.6f}")
        
        for i, ideal_vector in enumerate(self.ideal_vectors['perfect']):
            distance = np.linalg.norm(displacement_jump - ideal_vector)
            if self._debug_count <= 5:
                logger.debug(f"  Perfect vector {i}: {ideal_vector}, distance: {distance:.6f}")
            if distance < min_distance and distance < self.tolerance:
                min_distance = distance
                best_burgers = ideal_vector.copy()
                best_type = 'perfect'
        
        if 'partial' in self.ideal_vectors:
            for i, ideal_vector in enumerate(self.ideal_vectors['partial']):
                distance = np.linalg.norm(displacement_jump - ideal_vector)
                if self._debug_count <= 5:
                    logger.debug(f"  Partial vector {i}: {ideal_vector}, distance: {distance:.6f}")
                if distance < min_distance and distance < self.tolerance:
                    min_distance = distance
                    best_burgers = ideal_vector.copy()
                    best_type = 'partial'
        
        if self._debug_count <= 5:
            logger.debug(f"  Best distance: {min_distance:.6f}, type: {best_type}")
        
        return best_burgers, best_type
    
    def compute_edge_vectors(
        self, connectivity: Dict[int, set], 
        positions: np.ndarray
    ) -> Dict[Tuple[int, int], np.ndarray]:
        edge_vectors = {}
        
        for atom1, neighbors in connectivity.items():
            for atom2 in neighbors:
                if atom1 < atom2:
                    if self.box_bounds is not None and any(self.pbc):
                        # Use PBC-aware distance calculation
                        _, vector = compute_minimum_image_distance(
                            positions[atom1], positions[atom2], self.box_bounds
                        )
                    else:
                        vector = positions[atom2] - positions[atom1]
                    edge_vectors[(atom1, atom2)] = vector
        
        return edge_vectors
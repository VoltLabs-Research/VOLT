from scipy.spatial import SphericalVoronoi, Delaunay
from scipy.spatial.distance import cdist
from typing import Dict, List, Tuple, Set
from numba import jit
import numpy as np
import logging

logger = logging.getLogger(__name__)

class DelaunayTessellator:
    def __init__(self, positions: np.ndarray, box_bounds: np.ndarray, ghost_layer_thickness: float = 5.0):
        self.positions = positions.astype(np.float64)
        self.box_bounds = box_bounds
        self.box_lengths = box_bounds[:, 1] - box_bounds[:, 0]
        self.ghost_thickness = ghost_layer_thickness

        self.extended_positions, self.atom_mapping = self._create_ghost_layer()

    def _create_ghost_layer(self) -> Tuple[np.ndarray, Dict[int, int]]:
        original_positions = self.positions.copy()
        extended_positions = [original_positions]
        atom_mapping = { i: i for i in range(len(original_positions)) }
        
        # create ghost images in all directions
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                for dz in [-1, 0, 1]:
                    # skip original
                    if dx == 0 and dy == 0 and dz == 0:
                        continue
                    
                    # calculate displacement
                    shift = np.array([dx, dy, dz]) * self.box_lengths
                    ghost_position = original_positions + shift

                    # boundary atoms
                    mask = self._near_boundary(ghost_position)
                    if np.any(mask):
                        ghost_subset = ghost_position[mask]
                        extended_positions.append(ghost_subset)
                        start_idx = len(atom_mapping)
                        for i, original_idx in enumerate(np.where(mask)[0]):
                            atom_mapping[start_idx + i] = original_idx
        all_positions = np.vstack(extended_positions)
        logger.info(f'Delaunay: {len(original_positions)} atoms: {len(all_positions)} with ghosts')
        return all_positions, atom_mapping
    
    def _near_boundary(self, positions: np.ndarray) -> np.ndarray:
        mask = np.zeros(len(positions), dtype=bool)
        for dim in range(0, 3):
            min_bound, max_bound = self.box_bounds[dim]
            near_min = positions[:, dim] < (min_bound + self.ghost_thickness)
            near_max = positions[:, dim] > (max_bound - self.ghost_thickness)
            mask |= (near_min | near_max)
        return mask

    def tessellate(self) -> Dict[str, np.ndarray]:
        try:
            tessellation = Delaunay(self.extended_positions)
            valid_tetrahedra = self._filter_valid_tetrahedra(tessellation.simplices)
            connectivity = self._build_tetrahedral_connectivity(valid_tetrahedra)
            logger.info(f'Delaunay: {len(valid_tetrahedra)} valid tetrahedra')
            return {
                'tetrahedra': valid_tetrahedra,
                'connectivity': connectivity,
                'tessellation': tessellation
            }
        except Exception as e:
            logger.error(f'Delaunay tessellation failed: {e}')
            raise
    
    def _filter_valid_tetrahedra(self, simplices: np.ndarray) -> np.ndarray:
        n_original = len(self.positions)
        valid_mask = np.any(simplices < n_original, axis=1)
        return simplices[valid_mask]
    
    def _build_tetrahedral_connectivity(self, tetrahedra: np.ndarray) -> Dict[int, Set[int]]:
        connectivity = {i: set() for i in range(len(self.positions))}
        for tet in tetrahedra:
            real_indices = []
            for idx in tet:
                if idx < len(self.positions):
                    real_indices.append(idx)
                else:
                    real_indices.append(self.atom_mapping[idx])
            for i in range(4):
                for j in range(i + 1, 4):
                    atom1, atom2 = real_indices[i], real_indices[j]
                    if atom1 != atom2: 
                        connectivity[atom1].add(atom2)
                        connectivity[atom2].add(atom1)
        
        return connectivity
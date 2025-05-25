from typing import Dict, Set, List
import numpy as np
import logging

logger = logging.getLogger(__name__)

class DislocationCoreMarker:
    def __init__(self, core_radius: float = 2.0):
        self.core_radius = core_radius
    
    def mark_core_atoms(
        self,
        dislocation_lines: List[List[int]],
        positions: np.ndarray,
        burgers_vectors: Dict[int, np.ndarray]
    ) -> Dict[str, Set[int]]:
        core_atoms = set()
        
        for line_idx, line_atoms in enumerate(dislocation_lines):
            burgers_mag = np.linalg.norm(burgers_vectors.get(line_idx, np.zeros(3)))
            effective_radius = self.core_radius * (1 + burgers_mag)
            
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
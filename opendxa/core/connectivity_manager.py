import numpy as np
import logging
from typing import Dict, Set, List

logger = logging.getLogger(__name__)

class ConnectivityManager:
    def __init__(self, base_connectivity: Dict[int, Set[int]]):
        self.base_connectivity = base_connectivity
        self.enhanced_connectivity = None
        self.filtered_connectivity = None
        self._connectivity_lists = None
        
        # Cache for different representations
        self._as_sets_cache = None
        self._as_lists_cache = None
        
    def enhance_with_tessellation(
        self, 
        tessellation_connectivity: Dict[int, Set[int]], 
        max_atoms: int
    ) -> Dict[int, Set[int]]:
        if self.enhanced_connectivity is not None:
            return self.enhanced_connectivity
            
        # Start with copy of base connectivity
        enhanced = {}
        for atom_id, neighbors in self.base_connectivity.items():
            if isinstance(neighbors, list):
                enhanced[atom_id] = set(neighbors)
            else:
                enhanced[atom_id] = neighbors.copy()
        
        # Add tetrahedral connections
        for atom_id, tet_neighbors in tessellation_connectivity.items():
            if atom_id not in enhanced:
                enhanced[atom_id] = set()
            for neighbor_id in tet_neighbors:
                if neighbor_id < max_atoms:  # Only add connections within original atoms
                    enhanced[atom_id].add(neighbor_id)
                    if neighbor_id not in enhanced:
                        enhanced[neighbor_id] = set()
                    enhanced[neighbor_id].add(atom_id)
        
        self.enhanced_connectivity = enhanced
        
        # Log enhancement statistics
        n_original = sum(len(v) for v in self.base_connectivity.values()) // 2
        n_enhanced = sum(len(v) for v in enhanced.values()) // 2
        logger.info(f'Connectivity enhanced: {n_original} -> {n_enhanced} edges')
        
        return enhanced
    
    def filter_for_loop_finding(
        self,
        positions: np.ndarray, 
        max_connections_per_atom: int = 8
    ) -> Dict[int, List[int]]:
        if self.filtered_connectivity is not None:
            return self.filtered_connectivity
            
        # Use enhanced connectivity if available, otherwise base
        source_connectivity = self.enhanced_connectivity or self.base_connectivity
        
        filtered = {}
        for atom_id, neighbors in source_connectivity.items():
            neighbor_list = list(neighbors) if isinstance(neighbors, set) else neighbors
            
            if len(neighbor_list) <= max_connections_per_atom:
                filtered[atom_id] = neighbor_list
            else:
                # Keep only the closest neighbors for loop finding
                atom_pos = positions[atom_id]
                neighbor_distances = []
                for neighbor_id in neighbor_list:
                    if neighbor_id < len(positions):
                        neighbor_pos = positions[neighbor_id]
                        dist = np.linalg.norm(neighbor_pos - atom_pos)
                        neighbor_distances.append((dist, neighbor_id))
                
                # Sort by distance and keep the closest ones
                neighbor_distances.sort()
                closest_neighbors = [neighbor_id for _, neighbor_id in 
                                   neighbor_distances[:max_connections_per_atom]]
                filtered[atom_id] = closest_neighbors
        
        self.filtered_connectivity = filtered
        
        # Log filtering statistics
        source_edges = sum(len(v) for v in source_connectivity.values()) // 2
        filtered_edges = sum(len(v) for v in filtered.values()) // 2
        logger.info(f'Connectivity filtered for loops: {source_edges} -> {filtered_edges} edges')
        
        return filtered
    
    def as_sets(self, use_enhanced: bool = True) -> Dict[int, Set[int]]:
        if use_enhanced and self.enhanced_connectivity is not None:
            return self.enhanced_connectivity
        return self.base_connectivity
    
    def as_lists(self, use_enhanced: bool = True) -> Dict[int, List[int]]:
        if self._connectivity_lists is not None:
            return self._connectivity_lists
            
        source = self.as_sets(use_enhanced)
        lists = {}
        for atom_id, neighbors in source.items():
            if isinstance(neighbors, set):
                lists[atom_id] = list(neighbors)
            else:
                lists[atom_id] = neighbors
                
        self._connectivity_lists = lists
        return lists
    
    def get_edge_count(self, use_enhanced: bool = True) -> int:
        connectivity = self.as_sets(use_enhanced)
        return sum(len(v) for v in connectivity.values()) // 2
    
    def clear_cache(self):
        self._connectivity_lists = None
        self._as_sets_cache = None
        self._as_lists_cache = None

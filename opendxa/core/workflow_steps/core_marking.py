from typing import Dict, Set, List
import numpy as np
import logging

logger = logging.getLogger(__name__)

def step_mark_core_atoms(ctx, refinement, interface_mesh):
    """
    Mark atoms belonging to dislocation cores by assigning dislocation IDs,
    similar to OVITO's assignCoreAtomDislocationIDs functionality.
    """
    data = ctx['data']
    positions = data['positions']
    
    # Get refined dislocation lines
    refined_lines = refinement.get('refined_lines', [])
    
    # Get tessellation data from context
    tessellation = ctx.get('tessellation_result', {})
    tetrahedra = tessellation.get('tetrahedra', [])
    
    # Get interface mesh data
    interface_vertices = interface_mesh.get('vertices', np.array([]))
    interface_faces = interface_mesh.get('faces', np.array([]))
    tetrahedra_classification = interface_mesh.get('tetrahedra_classification', {})
    
    logger.info("Marking dislocation core atoms...")
    logger.info(f"Using interface mesh with {len(interface_vertices)} vertices and {len(interface_faces)} faces")
    
    # Create core atom marker
    core_marker = DislocationCoreMarker(
        positions=positions,
        tetrahedra=tetrahedra,
        dislocation_lines=refined_lines,
        interface_mesh={
            'vertices': interface_vertices,
            'faces': interface_faces,
            'tetrahedra_classification': tetrahedra_classification
        },
        core_radius=getattr(ctx.get('args'), 'core_radius', 2.0)
    )
    
    # Mark core atoms
    dislocation_ids = core_marker.assign_core_atom_ids()
    
    # Store for statistics computation
    core_marker._dislocation_ids = dislocation_ids
    
    logger.info(f"Marked {sum(1 for d_id in dislocation_ids.values() if d_id >= 0)} "
                f"atoms as dislocation core atoms")
    
    # Store in context for export
    ctx['dislocation_ids'] = dislocation_ids
    
    return {
        'dislocation_ids': dislocation_ids,
        'core_statistics': core_marker.get_core_statistics()
    }


class DislocationCoreMarker:
    """
    Marks atoms that belong to dislocation cores by identifying tetrahedra
    adjacent to dislocation lines and assigning dislocation IDs.
    """
    
    def __init__(self, positions, tetrahedra, dislocation_lines, interface_mesh=None, core_radius=2.0):
        self.positions = np.asarray(positions)
        self.tetrahedra = tetrahedra
        self.dislocation_lines = dislocation_lines
        self.interface_mesh = interface_mesh or {}
        self.core_radius = core_radius
        self.n_atoms = len(positions)
        
        # Extract interface mesh data
        self.interface_vertices = self.interface_mesh.get('vertices', np.array([]))
        self.interface_faces = self.interface_mesh.get('faces', np.array([]))
        self.tetrahedra_classification = self.interface_mesh.get('tetrahedra_classification', {})
    
    def assign_core_atom_ids(self) -> Dict[int, int]:
        """
        Assign dislocation IDs to core atoms using interface mesh information.
        Returns dict mapping atom_id -> dislocation_id (-1 for non-core atoms).
        """
        dislocation_ids = {i: -1 for i in range(self.n_atoms)}
        
        # If we have interface mesh data, prioritize bad tetrahedra
        bad_tetrahedra = set()
        if self.tetrahedra_classification:
            bad_tetrahedra = {tet_id for tet_id, is_good in self.tetrahedra_classification.items() if not is_good}
            logger.info(f"Found {len(bad_tetrahedra)} bad tetrahedra from interface mesh")
        
        # Process each dislocation line
        for line_id, line_data in enumerate(self.dislocation_lines):
            if 'points' not in line_data:
                continue
                
            line_points = np.asarray(line_data['points'])
            if len(line_points) == 0:
                continue
            
            # Find tetrahedra adjacent to this line
            if bad_tetrahedra:
                # Use interface mesh information: prioritize bad tetrahedra near the line
                adjacent_tetrahedra = self._find_adjacent_tetrahedra_with_interface(line_points, bad_tetrahedra)
            else:
                # Fallback to distance-based method
                adjacent_tetrahedra = self._find_adjacent_tetrahedra(line_points)
            
            # Assign dislocation ID to atoms in adjacent tetrahedra
            for tet_id in adjacent_tetrahedra:
                if tet_id < len(self.tetrahedra):
                    tetrahedron = self.tetrahedra[tet_id]
                    for atom_id in tetrahedron:
                        if atom_id < self.n_atoms and dislocation_ids[atom_id] == -1:
                            dislocation_ids[atom_id] = line_id
        
        return dislocation_ids
    
    def _find_adjacent_tetrahedra_with_interface(self, line_points: np.ndarray, bad_tetrahedra: Set[int]) -> Set[int]:
        """Find tetrahedra that are adjacent to the dislocation line, prioritizing bad tetrahedra"""
        adjacent_tets = set()
        
        # First, check bad tetrahedra that are close to the line
        for tet_id in bad_tetrahedra:
            if tet_id >= len(self.tetrahedra):
                continue
                
            tetrahedron = self.tetrahedra[tet_id]
            if len(tetrahedron) < 4:
                continue
                
            # Get tetrahedron centroid
            tet_positions = self.positions[tetrahedron]
            centroid = np.mean(tet_positions, axis=0)
            
            # Check distance to line
            min_distance = self._point_to_line_distance(centroid, line_points)
            
            if min_distance <= self.core_radius:
                adjacent_tets.add(tet_id)
        
        # If no bad tetrahedra found near the line, fall back to all tetrahedra
        if not adjacent_tets:
            adjacent_tets = self._find_adjacent_tetrahedra(line_points)
        
        return adjacent_tets
    
    def _find_adjacent_tetrahedra(self, line_points: np.ndarray) -> Set[int]:
        """Find tetrahedra that are adjacent to the dislocation line"""
        adjacent_tets = set()
        
        # For each tetrahedron, check if it's close to any line segment
        for tet_id, tetrahedron in enumerate(self.tetrahedra):
            if len(tetrahedron) < 4:
                continue
                
            # Get tetrahedron centroid
            tet_positions = self.positions[tetrahedron]
            centroid = np.mean(tet_positions, axis=0)
            
            # Check distance to line
            min_distance = self._point_to_line_distance(centroid, line_points)
            
            if min_distance <= self.core_radius:
                adjacent_tets.add(tet_id)
        
        return adjacent_tets
    
    def _point_to_line_distance(self, point: np.ndarray, line_points: np.ndarray) -> float:
        """Compute minimum distance from point to piecewise linear line"""
        if len(line_points) < 2:
            return float('inf')
        
        min_distance = float('inf')
        
        # Check distance to each line segment
        for i in range(len(line_points) - 1):
            p1 = line_points[i]
            p2 = line_points[i + 1]
            
            # Distance from point to line segment
            distance = self._point_to_segment_distance(point, p1, p2)
            min_distance = min(min_distance, distance)
        
        return min_distance
    
    def _point_to_segment_distance(self, point: np.ndarray, p1: np.ndarray, p2: np.ndarray) -> float:
        """Compute distance from point to line segment"""
        segment_vec = p2 - p1
        segment_length_sq = np.dot(segment_vec, segment_vec)
        
        if segment_length_sq < 1e-12:  # Degenerate segment
            return np.linalg.norm(point - p1)
        
        # Project point onto line
        t = np.dot(point - p1, segment_vec) / segment_length_sq
        t = max(0.0, min(1.0, t))  # Clamp to segment
        
        projection = p1 + t * segment_vec
        return np.linalg.norm(point - projection)
    
    def get_core_statistics(self) -> Dict:
        """Get statistics about marked core atoms"""
        if not hasattr(self, '_dislocation_ids'):
            return {}
        
        core_atoms_per_dislocation = {}
        total_core_atoms = 0
        
        for atom_id, disloc_id in self._dislocation_ids.items():
            if disloc_id >= 0:
                total_core_atoms += 1
                if disloc_id not in core_atoms_per_dislocation:
                    core_atoms_per_dislocation[disloc_id] = 0
                core_atoms_per_dislocation[disloc_id] += 1
        
        return {
            'total_core_atoms': total_core_atoms,
            'core_atoms_per_dislocation': core_atoms_per_dislocation,
            'total_dislocations': len(core_atoms_per_dislocation),
            'core_fraction': total_core_atoms / self.n_atoms if self.n_atoms > 0 else 0.0
        }

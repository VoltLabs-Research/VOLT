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
                # [10-10] and [-1010]
                [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0],
                # [-1100] and [1-100]
                [-0.5, np.sqrt(3)/2, 0.0], [0.5, -np.sqrt(3)/2, 0.0],
                # [-1-110] and [1110]
                [-0.5, -np.sqrt(3)/2, 0.0], [0.5, np.sqrt(3)/2, 0.0],
                # <0001> type vectors
                [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]  # [0001] and [000-1]
            ]),
            'partial': np.array([
                # <10-10>/3 type vectors - partial dislocations in HCP
                # [10-10]/3 and [-1010]/3
                [1/3, 0.0, 0.0], [-1/3, 0.0, 0.0],
                # [-1100]/3 and [1-100]/3
                [-1/6, np.sqrt(3)/6, 0.0], [1/6, -np.sqrt(3)/6, 0.0],
                # [-1-110]/3 and [1110]/3
                [-1/6, -np.sqrt(3)/6, 0.0], [1/6, np.sqrt(3)/6, 0.0],
                # <0001>/3 type vectors
                # [0001]/3 and [000-1]/3
                [0.0, 0.0, 1/3], [0.0, 0.0, -1/3]
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
        self.crystal_type = crystal_type.lower()
        self.lattice_param = lattice_parameter
        self.tolerance = tolerance
        self.box_bounds = box_bounds
        self.pbc = pbc
        self.ideal_vectors = {}
        for b_type, vectors in self.IDEAL_BURGERS[self.crystal_type].items():
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


class EnhancedElasticMapper:
    """
    Enhanced elastic mapping that uses cluster information to assign ideal vectors
    to tessellation edges based on the crystalline structure in each region.
    """
    
    def __init__(self, positions, clusters, cluster_transitions, crystal_type, lattice_parameter, box_bounds):
        self.positions = np.asarray(positions)
        self.clusters = clusters
        self.cluster_transitions = cluster_transitions
        self.crystal_type = crystal_type
        self.lattice_parameter = lattice_parameter
        self.box_bounds = box_bounds
        
        # Initialize base elastic mapper
        self.base_mapper = ElasticMapper(
            crystal_type=crystal_type,
            lattice_parameter=lattice_parameter,
            box_bounds=box_bounds
        )
        
        # Create atom to cluster mapping
        self.atom_to_cluster = {}
        for cluster_id, atoms in clusters.items():
            for atom in atoms:
                self.atom_to_cluster[atom] = cluster_id
    
    def compute_ideal_edge_vectors(self, edges, tetrahedra) -> Dict[Tuple[int, int], np.ndarray]:
        """
        Compute ideal vectors for tessellation edges based on cluster information.
        """
        ideal_vectors = {}
        mapping_stats = {'intra_cluster': 0, 'inter_cluster': 0, 'unknown': 0}
        
        logger.info(f"Computing ideal vectors for {len(edges)} edges")
        logger.info(f"Available clusters: {len(self.clusters)}")
        logger.info(f"Atoms in clusters: {sum(len(atoms) for atoms in self.clusters.values())}")
        
        for edge in edges:
            atom1, atom2 = edge
            
            # Get cluster assignments
            cluster1 = self.atom_to_cluster.get(atom1, -1)
            cluster2 = self.atom_to_cluster.get(atom2, -1)
            
            # Normalize edge key (sort to ensure consistent ordering)
            edge_key = tuple(sorted([atom1, atom2]))
            
            if cluster1 != -1 and cluster1 == cluster2:
                # Intra-cluster edge: use ideal lattice vector
                ideal_vector = self._compute_intra_cluster_ideal_vector(atom1, atom2, cluster1)
                ideal_vectors[edge_key] = ideal_vector
                mapping_stats['intra_cluster'] += 1
                
            elif cluster1 != -1 and cluster2 != -1 and cluster1 != cluster2:
                # Inter-cluster edge: use transition-based mapping
                ideal_vector = self._compute_inter_cluster_ideal_vector(atom1, atom2, cluster1, cluster2)
                ideal_vectors[edge_key] = ideal_vector
                mapping_stats['inter_cluster'] += 1
                
            else:
                # Edge involving unclustered atoms: use actual vector
                actual_vector = self.positions[atom2] - self.positions[atom1]
                ideal_vectors[edge_key] = actual_vector
                mapping_stats['unknown'] += 1
        
        self.mapping_stats = mapping_stats
        logger.info(f"Mapping statistics: {mapping_stats}")
        return ideal_vectors
    
    def _compute_intra_cluster_ideal_vector(self, atom1, atom2, cluster_id) -> np.ndarray:
        """Compute ideal vector for edge within a crystalline cluster"""
        
        # For intra-cluster edges, we expect them to follow perfect lattice vectors
        actual_vector = self.positions[atom2] - self.positions[atom1]
        
        # Use base elastic mapper to find closest ideal vector
        displacement_jumps = {(atom1, atom2): actual_vector}
        displacement_field = {atom1: np.zeros(3), atom2: actual_vector}
        
        edge_burgers = self.base_mapper.map_edge_burgers(displacement_jumps, displacement_field)
        
        return edge_burgers.get((atom1, atom2), actual_vector)
    
    def _compute_inter_cluster_ideal_vector(self, atom1, atom2, cluster1, cluster2) -> np.ndarray:
        """Compute ideal vector for edge between different clusters"""
        
        # For inter-cluster edges, the ideal vector represents the lattice mismatch
        actual_vector = self.positions[atom2] - self.positions[atom1]
        
        # This could be enhanced to account for different lattice orientations
        # between clusters, but for now we use the actual vector as approximation
        return actual_vector
    
    def get_mapping_statistics(self) -> Dict:
        """Get statistics about the elastic mapping"""
        return getattr(self, 'mapping_stats', {})


class InterfaceMeshBuilder:
    """
    Builds interface mesh by identifying boundaries between good and bad tetrahedra
    and creating triangulated surfaces.
    """
    
    def __init__(self, positions, tetrahedra, ideal_edge_vectors, defect_threshold=0.3):
        self.positions = np.asarray(positions)
        self.tetrahedra = tetrahedra
        self.ideal_edge_vectors = ideal_edge_vectors
        self.defect_threshold = defect_threshold
    
    def build_interface_mesh(self) -> Dict:
        """
        Build the interface mesh by finding faces between good and bad tetrahedra.
        """
        logger.info(f"Building interface mesh with {len(self.tetrahedra)} tetrahedra")
        logger.info(f"Using defect threshold: {self.defect_threshold}")
        logger.info(f"Available ideal edge vectors: {len(self.ideal_edge_vectors)}")
        
        # Classify tetrahedra as good/bad based on edge vector deviations
        tetrahedra_classification = self._classify_tetrahedra()
        
        num_good = sum(1 for is_good in tetrahedra_classification.values() if is_good)
        num_bad = sum(1 for is_good in tetrahedra_classification.values() if not is_good)
        
        logger.info(f"Tetrahedra classification: {num_good} good, {num_bad} bad")
        
        # Find interface faces
        interface_faces = self._find_interface_faces(tetrahedra_classification)
        
        logger.info(f"Found {len(interface_faces)} interface faces")
        
        # Extract unique vertices
        vertices, faces = self._extract_mesh_geometry(interface_faces)
        
        logger.info(f"Generated mesh: {len(vertices)} vertices, {len(faces)} faces")
        
        return {
            'vertices': vertices,
            'faces': faces,
            'tetrahedra_classification': tetrahedra_classification,
            'num_good_tetrahedra': num_good,
            'num_bad_tetrahedra': num_bad
        }
    
    def _classify_tetrahedra(self) -> Dict[int, bool]:
        """Classify tetrahedra as good (True) or bad (False) based on edge deviations"""
        classification = {}
        edge_misses = 0
        total_edges = 0
        
        for tet_id, tetrahedron in enumerate(self.tetrahedra):
            if len(tetrahedron) < 4:
                classification[tet_id] = False
                continue
                
            # Check all edges of the tetrahedron
            edges = [
                (tetrahedron[0], tetrahedron[1]),
                (tetrahedron[0], tetrahedron[2]),
                (tetrahedron[0], tetrahedron[3]),
                (tetrahedron[1], tetrahedron[2]),
                (tetrahedron[1], tetrahedron[3]),
                (tetrahedron[2], tetrahedron[3])
            ]
            
            is_good = True
            max_deviation = 0.0
            
            for edge in edges:
                total_edges += 1
                # Normalize edge direction (sort to ensure consistent key)
                edge_key = tuple(sorted(edge))
                
                if edge_key in self.ideal_edge_vectors:
                    actual_vector = self.positions[edge[1]] - self.positions[edge[0]]
                    ideal_vector = self.ideal_edge_vectors[edge_key]
                    
                    # Compute deviation
                    deviation = np.linalg.norm(actual_vector - ideal_vector)
                    ideal_norm = np.linalg.norm(ideal_vector)
                    relative_deviation = deviation / max(ideal_norm, 1e-6)
                    
                    max_deviation = max(max_deviation, relative_deviation)
                    
                    if relative_deviation > self.defect_threshold:
                        is_good = False
                        break
                else:
                    edge_misses += 1
                    # If we don't have ideal vector, assume it's defective
                    is_good = False
                    break
            
            classification[tet_id] = is_good
        
        logger.info(f"Edge statistics: {edge_misses}/{total_edges} edges missing ideal vectors")
        return classification
    
    def _find_interface_faces(self, tetrahedra_classification) -> List[Tuple[int, int, int]]:
        """Find faces that separate good and bad tetrahedra"""
        interface_faces = []
        
        # Build face to tetrahedra mapping
        face_to_tets = {}
        
        for tet_id, tetrahedron in enumerate(self.tetrahedra):
            if len(tetrahedron) < 4:
                continue
                
            # Get all faces of this tetrahedron
            faces = [
                tuple(sorted([tetrahedron[0], tetrahedron[1], tetrahedron[2]])),
                tuple(sorted([tetrahedron[0], tetrahedron[1], tetrahedron[3]])),
                tuple(sorted([tetrahedron[0], tetrahedron[2], tetrahedron[3]])),
                tuple(sorted([tetrahedron[1], tetrahedron[2], tetrahedron[3]]))
            ]
            
            for face in faces:
                if face not in face_to_tets:
                    face_to_tets[face] = []
                face_to_tets[face].append(tet_id)
        
        # Find interface faces (faces shared by good and bad tetrahedra)
        for face, tet_ids in face_to_tets.items():
            if len(tet_ids) == 2:
                tet1, tet2 = tet_ids
                is_good1 = tetrahedra_classification.get(tet1, False)
                is_good2 = tetrahedra_classification.get(tet2, False)
                
                if is_good1 != is_good2:  # One good, one bad
                    interface_faces.append(face)
        
        return interface_faces
    
    def _extract_mesh_geometry(self, interface_faces) -> Tuple[np.ndarray, np.ndarray]:
        """Extract vertices and faces for the interface mesh"""
        if not interface_faces:
            return np.array([]), np.array([])
        
        # Get unique vertices
        unique_vertices = set()
        for face in interface_faces:
            unique_vertices.update(face)
        
        # Create vertex mapping
        vertex_list = sorted(unique_vertices)
        vertex_to_index = {v: i for i, v in enumerate(vertex_list)}
        
        # Extract vertex positions
        vertices = self.positions[vertex_list]
        
        # Remap faces to new indices
        faces = []
        for face in interface_faces:
            remapped_face = [vertex_to_index[v] for v in face]
            faces.append(remapped_face)
        
        return vertices, np.array(faces)
    
    def smooth_mesh(self, interface_mesh, iterations=3, relaxation_factor=0.5) -> Dict:
        """Apply Laplacian smoothing to the interface mesh"""
        vertices = interface_mesh['vertices'].copy()
        faces = interface_mesh['faces']
        
        if len(vertices) == 0 or len(faces) == 0:
            return interface_mesh
        
        # Build vertex connectivity
        vertex_neighbors = [set() for _ in range(len(vertices))]
        for face in faces:
            for i in range(3):
                for j in range(3):
                    if i != j:
                        vertex_neighbors[face[i]].add(face[j])
        
        # Apply smoothing iterations
        for iteration in range(iterations):
            new_vertices = vertices.copy()
            
            for i, neighbors in enumerate(vertex_neighbors):
                if len(neighbors) > 0:
                    # Compute average position of neighbors
                    neighbor_positions = vertices[list(neighbors)]
                    avg_position = np.mean(neighbor_positions, axis=0)
                    
                    # Apply relaxation
                    new_vertices[i] = (
                        (1.0 - relaxation_factor) * vertices[i] + 
                        relaxation_factor * avg_position
                    )
            
            vertices = new_vertices
        
        # Return smoothed mesh
        smoothed_mesh = interface_mesh.copy()
        smoothed_mesh['vertices'] = vertices
        return smoothed_mesh
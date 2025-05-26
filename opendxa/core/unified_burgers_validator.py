import numpy as np
import logging
from typing import Dict, List, Optional, Any
from opendxa.classification.elastic_mapper import ElasticMapper
from opendxa.filters.burgers_normalizer import BurgersNormalizer

logger = logging.getLogger(__name__)

class UnifiedBurgersValidator:
    def __init__(
        self, 
        crystal_type: str = 'fcc',
        lattice_parameter: float = 1.0,
        tolerance: float = 0.15,
        validation_tolerance: float = 0.3,
        box_bounds: Optional[np.ndarray] = None,
        pbc: List[bool] = [True, True, True],
        allow_non_standard: bool = True
    ):
        self.crystal_type = crystal_type
        self.lattice_parameter = lattice_parameter
        self.tolerance = tolerance
        self.validation_tolerance = validation_tolerance
        self.allow_non_standard = allow_non_standard
        
        # Initialize normalizer for primary validation
        self.normalizer = BurgersNormalizer(
            crystal_type=crystal_type,
            lattice_parameter=lattice_parameter,
            tolerance=tolerance
        )
        
        # Initialize elastic mapper for secondary validation
        self.elastic_mapper = ElasticMapper(
            crystal_type=crystal_type,
            lattice_parameter=lattice_parameter,
            tolerance=validation_tolerance,
            box_bounds=box_bounds,
            pbc=pbc
        )
        
        # Define standard Burgers vectors for different crystal structures
        self._define_standard_burgers_vectors()
        
        logger.info(f'UnifiedBurgersValidator initialized: {crystal_type}, '
                   f'a={lattice_parameter:.3f} Å, tol={tolerance:.3f}, '
                   f'allow_non_standard={allow_non_standard}')
    
    def _define_standard_burgers_vectors(self):
        """Define standard Burgers vectors for different crystal structures"""
        a = self.lattice_parameter
        
        self.standard_burgers = {
            'fcc': {
                'perfect': [
                    a/2 * np.array([1, 1, 0]),
                    a/2 * np.array([1, -1, 0]),
                    a/2 * np.array([1, 0, 1]),
                    a/2 * np.array([1, 0, -1]),
                    a/2 * np.array([0, 1, 1]),
                    a/2 * np.array([0, 1, -1])
                ],
                'partial': [
                    a/6 * np.array([1, 1, 2]),
                    a/6 * np.array([1, 1, -2]),
                    a/6 * np.array([1, -1, 2]),
                    a/6 * np.array([1, -1, -2]),
                    a/6 * np.array([1, 2, 1]),
                    a/6 * np.array([1, -2, 1]),
                    a/6 * np.array([-1, 2, 1]),
                    a/6 * np.array([-1, -2, 1]),
                    a/6 * np.array([2, 1, 1]),
                    a/6 * np.array([2, 1, -1]),
                    a/6 * np.array([2, -1, 1]),
                    a/6 * np.array([2, -1, -1])
                ]
            },
            'bcc': {
                'perfect': [
                    a/2 * np.array([1, 1, 1]),
                    a/2 * np.array([1, 1, -1]),
                    a/2 * np.array([1, -1, 1]),
                    a/2 * np.array([1, -1, -1])
                ],
                'partial': [
                    a/2 * np.array([1, 0, 0]),
                    a/2 * np.array([0, 1, 0]),
                    a/2 * np.array([0, 0, 1])
                ]
            },
            'hcp': {
                'perfect': [
                    a * np.array([1, 0, 0]),
                    a * np.array([-1/2, np.sqrt(3)/2, 0]),
                    a * np.array([-1/2, -np.sqrt(3)/2, 0])
                ],
                'partial': [
                    a/3 * np.array([1, 0, 0]),
                    a/3 * np.array([-1/2, np.sqrt(3)/2, 0]),
                    a/3 * np.array([-1/2, -np.sqrt(3)/2, 0])
                ]
            }
        }
    
    def validate_burgers_vectors(
        self,
        primary_burgers: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[int, np.ndarray],
        connectivity: Dict[int, List[int]],
        ideal_edge_vectors: Optional[Dict] = None,
        elastic_mapping_stats: Optional[Dict] = None,
        interface_mesh: Optional[Dict] = None,
        defect_regions: Optional[Dict] = None,
        ptm_types: Optional[np.ndarray] = None
    ) -> Dict[str, Any]:
        logger.info(f'Validating {len(primary_burgers)} Burgers vectors')
        
        # Check if enhanced data is available
        has_enhanced_elastic = ideal_edge_vectors is not None
        has_interface_mesh = interface_mesh is not None
        
        if has_enhanced_elastic:
            logger.info('Using enhanced elastic mapping data for validation')
        if has_interface_mesh:
            logger.info('Using interface mesh data for validation')
        
        # Step 1: Primary validation (normalization) with extended structure analysis
        primary_validation = self._validate_primary_burgers(
            primary_burgers, ptm_types, loops, positions
        )
        
        # Step 2: Secondary validation (elastic mapping - enhanced if available)
        if has_enhanced_elastic:
            secondary_validation = self._validate_with_enhanced_elastic_mapping(
                primary_burgers, loops, positions, displacement_field, 
                connectivity, ideal_edge_vectors
            )
        else:
            secondary_validation = self._validate_with_elastic_mapping(
                primary_burgers, loops, positions, displacement_field, connectivity
            )
        
        # Step 3: Interface mesh validation (if available)
        interface_validation = {}
        if has_interface_mesh:
            interface_validation = self._validate_with_interface_mesh(
                primary_burgers, loops, positions, interface_mesh, defect_regions
            )
        
        # Step 4: Cross-validation consistency check
        consistency_metrics = self._compute_enhanced_consistency_metrics(
            primary_validation, secondary_validation, interface_validation
        )
        
        # Step 5: Final validated set with enhancement metrics
        final_validated = self._create_enhanced_final_validation(
            primary_validation, secondary_validation, interface_validation, consistency_metrics
        )
        
        # Step 6: Compute enhancement metrics
        enhancement_metrics = {}
        if has_enhanced_elastic or has_interface_mesh:
            enhancement_metrics = self._compute_enhancement_metrics(
                primary_validation, secondary_validation, interface_validation,
                has_enhanced_elastic, has_interface_mesh
            )
        
        logger.info(f'Enhanced validation complete: {len(final_validated["valid_loops"])} valid loops '
                   f'(consistency: {consistency_metrics["overall_consistency"]:.2f})')
        
        if enhancement_metrics:
            logger.info(f'Enhancement score: {enhancement_metrics.get("enhancement_score", 0.0):.2f}')
        
        return {
            'primary_validation': primary_validation,
            'secondary_validation': secondary_validation,
            'interface_validation': interface_validation,
            'consistency_metrics': consistency_metrics,
            'enhancement_metrics': enhancement_metrics,
            'final_validation': final_validated
        }
    
    def _validate_primary_burgers(self, burgers_vectors: Dict[int, np.ndarray], 
                                ptm_types: Optional[np.ndarray] = None, 
                                loops: Optional[List[List[int]]] = None,
                                positions: Optional[np.ndarray] = None) -> Dict[str, Any]:
        validated_loops = []
        normalized_burgers = {}
        burgers_classifications = {}
        validation_stats = {
            'fcc_perfect': 0, 'fcc_partial': 0,
            'bcc_perfect': 0, 'bcc_partial': 0,
            'hcp_perfect': 0, 'hcp_partial': 0,
            'non_standard': 0, 'unknown': 0, 'zero': 0
        }
        magnitudes = []
        structure_analysis = {}
        
        for loop_id, burger_vector in burgers_vectors.items():
            magnitude = np.linalg.norm(burger_vector)
            magnitudes.append(magnitude)
            
            if magnitude > 1e-5:
                # Analyze local structure if data is available
                local_structure = None
                if (loops is not None and len(loops) > 0 and 
                    positions is not None and len(positions) > 0 and 
                    ptm_types is not None and len(ptm_types) > 0 and 
                    loop_id < len(loops)):
                    loop = loops[loop_id]
                    loop_structure = self.analyze_loop_structure(loop, positions, ptm_types)
                    local_structure = loop_structure['dominant_structure']
                    structure_analysis[loop_id] = loop_structure
                
                # Classify the Burgers vector with extended analysis
                classification = self.classify_burgers_vector(burger_vector, local_structure)
                burgers_classifications[loop_id] = classification
                
                # Try standard normalization first
                normalized, b_type, distance = self.normalizer.normalize_burgers_vector(burger_vector)
                
                # Update classification based on normalization result
                if b_type in ['perfect', 'partial'] and classification['is_standard']:
                    # Standard dislocation successfully normalized
                    family_key = f"{classification['crystal_structure']}_{b_type}"
                    validation_stats[family_key] = validation_stats.get(family_key, 0) + 1
                    normalized_burgers[loop_id] = normalized
                    validated_loops.append(loop_id)
                    
                elif self.allow_non_standard and magnitude > 0.1 * self.lattice_parameter:
                    # Non-standard but potentially valid dislocation
                    validation_stats['non_standard'] += 1
                    normalized_burgers[loop_id] = burger_vector  # Keep original vector
                    validated_loops.append(loop_id)
                    classification['validation_method'] = 'non_standard'
                    
                else:
                    # Could not validate
                    validation_stats['unknown'] += 1
                    classification['validation_method'] = 'failed'
                    
            else:
                validation_stats['zero'] += 1
        
        return {
            'valid_loops': validated_loops,
            'normalized_burgers': normalized_burgers,
            'burgers_classifications': burgers_classifications,
            'structure_analysis': structure_analysis,
            'stats': validation_stats,
            'magnitudes': magnitudes
        }
    
    def _validate_with_elastic_mapping(
        self, 
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[int, np.ndarray],
        connectivity: Dict[int, List[int]]
    ) -> Dict[str, Any]:
        # Create edge vectors from connectivity
        edge_vectors = self.elastic_mapper.compute_edge_vectors(connectivity, positions)
        
        # Map edges to Burgers vectors using elastic mapping
        edge_burgers = self.elastic_mapper.map_edge_burgers(edge_vectors, displacement_field)
        
        # For each loop, compute the sum of edge Burgers around the loop
        loop_elastic_burgers = {}
        validation_results = {}
        
        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue
                
            # Sum Burgers vectors around the loop edges
            loop_burgers_sum = np.zeros(3)
            valid_edges = 0
            
            for i in range(len(loop_atoms)):
                atom1 = loop_atoms[i]
                atom2 = loop_atoms[(i + 1) % len(loop_atoms)]
                edge_key = (min(atom1, atom2), max(atom1, atom2))
                
                if edge_key in edge_burgers:
                    loop_burgers_sum += edge_burgers[edge_key]
                    valid_edges += 1
            
            if valid_edges > 0:
                loop_elastic_burgers[loop_id] = loop_burgers_sum
                
                # Compare with primary method
                primary_burgers = burgers_vectors[loop_id]
                difference = np.linalg.norm(loop_burgers_sum - primary_burgers)
                relative_error = difference / (np.linalg.norm(primary_burgers) + 1e-10)
                
                validation_results[loop_id] = {
                    'elastic_burgers': loop_burgers_sum,
                    'primary_burgers': primary_burgers,
                    'difference': difference,
                    'relative_error': relative_error,
                    'is_consistent': relative_error < 0.5  # 50% tolerance
                }
        
        return {
            'edge_burgers': edge_burgers,
            'loop_elastic_burgers': loop_elastic_burgers,
            'validation_results': validation_results
        }
    
    def _validate_with_enhanced_elastic_mapping(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[int, np.ndarray],
        connectivity: Dict[int, List[int]],
        ideal_edge_vectors: Dict
    ) -> Dict[str, Any]:
        """Enhanced elastic mapping validation using ideal edge vectors from clustering"""
        
        loop_elastic_burgers = {}
        validation_results = {}
        
        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue
                
            # Sum ideal edge vectors around the loop
            loop_burgers_sum = np.zeros(3)
            valid_edges = 0
            
            for i in range(len(loop_atoms)):
                atom1 = loop_atoms[i]
                atom2 = loop_atoms[(i + 1) % len(loop_atoms)]
                edge_key = (min(atom1, atom2), max(atom1, atom2))
                
                if edge_key in ideal_edge_vectors:
                    # Use ideal vector from enhanced elastic mapping
                    actual_vector = positions[atom2] - positions[atom1]
                    ideal_vector = ideal_edge_vectors[edge_key]
                    burgers_contribution = actual_vector - ideal_vector
                    
                    loop_burgers_sum += burgers_contribution
                    valid_edges += 1
            
            if valid_edges > 0:
                loop_elastic_burgers[loop_id] = loop_burgers_sum
                
                # Compare with primary method
                primary_burgers = burgers_vectors[loop_id]
                difference = np.linalg.norm(loop_burgers_sum - primary_burgers)
                relative_error = difference / (np.linalg.norm(primary_burgers) + 1e-10)
                
                validation_results[loop_id] = {
                    'elastic_burgers': loop_burgers_sum,
                    'primary_burgers': primary_burgers,
                    'difference': difference,
                    'relative_error': relative_error,
                    'is_consistent': relative_error < 0.3,  # Tighter tolerance for enhanced method
                    'valid_edges': valid_edges,
                    'total_edges': len(loop_atoms)
                }
        
        return {
            'loop_elastic_burgers': loop_elastic_burgers,
            'validation_results': validation_results,
            'method': 'enhanced_elastic_mapping'
        }
    
    def _validate_with_interface_mesh(
        self,
        burgers_vectors: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        interface_mesh: Dict,
        defect_regions: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Validate loops against interface mesh to check if they enclose defective regions"""
        
        mesh_validation_results = {}
        
        # Get interface mesh data
        vertices = interface_mesh.get('vertices', np.array([]))
        faces = interface_mesh.get('faces', np.array([]))
        
        if len(vertices) == 0 or len(faces) == 0:
            logger.warning("Interface mesh is empty, skipping mesh validation")
            return {'validation_results': {}, 'method': 'interface_mesh'}
        
        for loop_id, loop_atoms in enumerate(loops):
            if loop_id not in burgers_vectors:
                continue
            
            # Get loop centroid
            loop_positions = positions[loop_atoms]
            loop_centroid = np.mean(loop_positions, axis=0)
            
            # Check proximity to interface mesh
            min_distance_to_interface = self._compute_point_to_mesh_distance(
                loop_centroid, vertices, faces
            )
            
            # Check if loop encloses defective regions
            defect_enclosure_score = 0.0
            if defect_regions:
                defect_enclosure_score = self._compute_defect_enclosure_score(
                    loop_atoms, positions, defect_regions
                )
            
            # Validation based on interface proximity and defect enclosure
            is_interface_consistent = (
                min_distance_to_interface < 5.0 and  # Within 5 units of interface
                defect_enclosure_score > 0.1  # Encloses some defective regions
            )
            
            mesh_validation_results[loop_id] = {
                'interface_distance': min_distance_to_interface,
                'defect_enclosure_score': defect_enclosure_score,
                'is_interface_consistent': is_interface_consistent,
                'loop_centroid': loop_centroid.tolist()
            }
        
        return {
            'validation_results': mesh_validation_results,
            'method': 'interface_mesh'
        }
    
    def _compute_consistency_metrics(self, 
                                   primary_validation: Dict[str, Any],
                                   secondary_validation: Dict[str, Any]) -> Dict[str, Any]:
        validation_results = secondary_validation['validation_results']
        
        if not validation_results:
            return {
                'overall_consistency': 0.0,
                'consistent_loops': [],
                'inconsistent_loops': [],
                'mean_relative_error': float('inf'),
                'consistency_ratio': 0.0
            }
        
        consistent_loops = []
        inconsistent_loops = []
        relative_errors = []
        
        for loop_id, result in validation_results.items():
            relative_error = result['relative_error']
            relative_errors.append(relative_error)
            
            if result['is_consistent']:
                consistent_loops.append(loop_id)
            else:
                inconsistent_loops.append(loop_id)
        
        consistency_ratio = len(consistent_loops) / len(validation_results)
        mean_relative_error = np.mean(relative_errors)
        overall_consistency = 1.0 - min(mean_relative_error, 1.0)
        
        logger.info(f'Consistency metrics: {len(consistent_loops)}/{len(validation_results)} '
                   f'consistent loops ({consistency_ratio:.2f}), '
                   f'mean error: {mean_relative_error:.3f}')
        
        return {
            'overall_consistency': overall_consistency,
            'consistent_loops': consistent_loops,
            'inconsistent_loops': inconsistent_loops,
            'mean_relative_error': mean_relative_error,
            'consistency_ratio': consistency_ratio,
            'relative_errors': relative_errors
        }
    
    def _compute_enhanced_consistency_metrics(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Compute enhanced consistency metrics including interface mesh data"""
        
        # Start with basic consistency metrics
        base_metrics = self._compute_consistency_metrics(primary_validation, secondary_validation)
        
        # Add interface consistency if available
        if interface_validation and 'validation_results' in interface_validation:
            interface_results = interface_validation['validation_results']
            
            interface_consistent_loops = []
            interface_inconsistent_loops = []
            
            for loop_id, result in interface_results.items():
                if result.get('is_interface_consistent', False):
                    interface_consistent_loops.append(loop_id)
                else:
                    interface_inconsistent_loops.append(loop_id)
            
            # Compute interface consistency ratio
            total_interface_loops = len(interface_results)
            interface_consistency_ratio = (
                len(interface_consistent_loops) / total_interface_loops 
                if total_interface_loops > 0 else 0.0
            )
            
            # Update overall consistency considering interface
            base_consistency = base_metrics['overall_consistency']
            interface_weight = 0.3  # 30% weight for interface consistency
            enhanced_consistency = (
                (1.0 - interface_weight) * base_consistency + 
                interface_weight * interface_consistency_ratio
            )
            
            base_metrics.update({
                'interface_consistent_loops': interface_consistent_loops,
                'interface_inconsistent_loops': interface_inconsistent_loops,
                'interface_consistency_ratio': interface_consistency_ratio,
                'enhanced_overall_consistency': enhanced_consistency
            })
        
        return base_metrics
    
    def _create_final_validation(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        consistency_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Start with primary validation
        primary_valid = set(primary_validation['valid_loops'])
        consistent_loops = set(consistency_metrics['consistent_loops'])
        
        # Final valid loops are those that pass both validations
        final_valid_loops = list(primary_valid.intersection(consistent_loops))
        
        # Use normalized Burgers from primary method for consistent loops
        final_normalized_burgers = {}
        for loop_id in final_valid_loops:
            if loop_id in primary_validation['normalized_burgers']:
                final_normalized_burgers[loop_id] = primary_validation['normalized_burgers'][loop_id]
        
        # Combine statistics
        final_stats = primary_validation['stats'].copy()
        final_stats['consistency_validated'] = len(final_valid_loops)
        final_stats['consistency_ratio'] = consistency_metrics['consistency_ratio']
        
        return {
            'valid_loops': final_valid_loops,
            'normalized_burgers': final_normalized_burgers,
            'stats': final_stats,
            'quality_score': consistency_metrics['overall_consistency']
        }
    
    def _create_enhanced_final_validation(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any],
        consistency_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create final validation results considering all methods"""
        
        # Start with basic final validation
        base_final = self._create_final_validation(
            primary_validation, secondary_validation, consistency_metrics
        )
        
        # Refine based on interface validation if available
        if interface_validation and 'validation_results' in interface_validation:
            primary_valid = set(primary_validation['valid_loops'])
            elastic_consistent = set(consistency_metrics['consistent_loops'])
            interface_consistent = set(consistency_metrics.get('interface_consistent_loops', []))
            
            # Final valid loops must pass all available validations
            if interface_consistent:
                final_valid_loops = list(primary_valid.intersection(elastic_consistent).intersection(interface_consistent))
            else:
                final_valid_loops = list(primary_valid.intersection(elastic_consistent))
            
            # Update final validation
            base_final['valid_loops'] = final_valid_loops
            base_final['validation_methods_used'] = ['primary', 'elastic_mapping']
            if interface_consistent:
                base_final['validation_methods_used'].append('interface_mesh')
            
            # Update quality score
            if 'enhanced_overall_consistency' in consistency_metrics:
                base_final['quality_score'] = consistency_metrics['enhanced_overall_consistency']
        
        return base_final
    
    def _compute_enhancement_metrics(
        self,
        primary_validation: Dict[str, Any],
        secondary_validation: Dict[str, Any],
        interface_validation: Dict[str, Any],
        has_enhanced_elastic: bool,
        has_interface_mesh: bool
    ) -> Dict[str, Any]:
        """Compute metrics showing the value of the enhancements"""
        
        enhancement_metrics = {
            'enhancement_score': 0.0,
            'elastic_enhancement': 0.0,
            'interface_enhancement': 0.0,
            'methods_used': []
        }
        
        baseline_valid_count = len(primary_validation['valid_loops'])
        
        if has_enhanced_elastic:
            enhancement_metrics['methods_used'].append('enhanced_elastic_mapping')
            
            # Compare enhanced vs. basic elastic mapping accuracy
            if 'validation_results' in secondary_validation:
                enhanced_errors = [
                    result['relative_error'] 
                    for result in secondary_validation['validation_results'].values()
                ]
                if enhanced_errors:
                    enhancement_metrics['elastic_enhancement'] = 1.0 - np.mean(enhanced_errors)
        
        if has_interface_mesh:
            enhancement_metrics['methods_used'].append('interface_mesh')
            
            # Measure interface correlation with Burgers vectors
            if 'validation_results' in interface_validation:
                interface_scores = [
                    result['defect_enclosure_score']
                    for result in interface_validation['validation_results'].values()
                ]
                if interface_scores:
                    enhancement_metrics['interface_enhancement'] = np.mean(interface_scores)
                    enhancement_metrics['interface_correlation'] = np.std(interface_scores)
        
        # Overall enhancement score
        enhancement_metrics['enhancement_score'] = (
            0.6 * enhancement_metrics['elastic_enhancement'] +
            0.4 * enhancement_metrics['interface_enhancement']
        )
        
        return enhancement_metrics
    
    # Helper methods for interface mesh validation
    
    def _compute_point_to_mesh_distance(
        self, 
        point: np.ndarray, 
        vertices: np.ndarray, 
        faces: np.ndarray
    ) -> float:
        """Compute minimum distance from point to triangulated mesh"""
        
        if len(faces) == 0:
            return float('inf')
        
        min_distance = float('inf')
        
        for face in faces:
            if len(face) >= 3:
                # Get triangle vertices
                v0, v1, v2 = vertices[face[0]], vertices[face[1]], vertices[face[2]]
                
                # Compute distance to triangle
                distance = self._point_to_triangle_distance(point, v0, v1, v2)
                min_distance = min(min_distance, distance)
        
        return min_distance
    
    def _point_to_triangle_distance(
        self, 
        point: np.ndarray, 
        v0: np.ndarray, 
        v1: np.ndarray, 
        v2: np.ndarray
    ) -> float:
        """Compute distance from point to triangle"""
        
        # Project point onto triangle plane
        edge1 = v1 - v0
        edge2 = v2 - v0
        normal = np.cross(edge1, edge2)
        normal_length = np.linalg.norm(normal)
        
        if normal_length < 1e-12:
            # Degenerate triangle
            return min(
                np.linalg.norm(point - v0),
                np.linalg.norm(point - v1),
                np.linalg.norm(point - v2)
            )
        
        normal = normal / normal_length
        
        # Distance to plane
        to_point = point - v0
        plane_distance = abs(np.dot(to_point, normal))
        
        # Project point onto plane
        projected = point - plane_distance * normal
        
        # Check if projection is inside triangle (simplified)
        # For now, return plane distance as approximation
        return plane_distance
    
    def _compute_defect_enclosure_score(
        self,
        loop_atoms: List[int],
        positions: np.ndarray,
        defect_regions: Dict
    ) -> float:
        """Compute how well the loop encloses defective regions"""
        
        # Get loop bounding box
        loop_positions = positions[loop_atoms]
        loop_min = np.min(loop_positions, axis=0)
        loop_max = np.max(loop_positions, axis=0)
        
        # Count defective tetrahedra within loop bounds
        enclosed_defects = 0
        total_defects = 0
        
        for tet_id, is_good in defect_regions.items():
            total_defects += 1
            if not is_good:  # Bad tetrahedron
                # Simple enclosure check (could be improved with proper geometry)
                # For now, check if any atom of the tetrahedron is within loop bounds
                enclosed_defects += 1
        
        return enclosed_defects / total_defects if total_defects > 0 else 0.0
    
    def classify_burgers_vector(self, burgers_vector: np.ndarray, local_structure: str = None) -> Dict[str, Any]:
        """
        Classify a Burgers vector based on crystal structure and return detailed information
        """
        magnitude = np.linalg.norm(burgers_vector)
        
        # Try to determine structure if not provided
        if local_structure is None:
            local_structure = self._detect_local_structure(burgers_vector)
        
        classification = {
            'magnitude': magnitude,
            'normalized_vector': burgers_vector / max(magnitude, 1e-10),
            'crystal_structure': local_structure,
            'is_standard': False,
            'dislocation_type': 'unknown',
            'family': 'unknown'
        }
        
        # Check against standard vectors for the detected structure
        if local_structure in self.standard_burgers:
            standard_vectors = self.standard_burgers[local_structure]
            
            # Check perfect dislocations first
            best_match, min_error = self._find_best_match(burgers_vector, standard_vectors['perfect'])
            if min_error < self.tolerance:
                classification.update({
                    'is_standard': True,
                    'dislocation_type': 'perfect',
                    'family': f'{local_structure}_perfect',
                    'match_error': min_error,
                    'standard_vector': best_match
                })
                return classification
            
            # Check partial dislocations
            best_match, min_error = self._find_best_match(burgers_vector, standard_vectors['partial'])
            if min_error < self.tolerance:
                classification.update({
                    'is_standard': True,
                    'dislocation_type': 'partial',
                    'family': f'{local_structure}_partial',
                    'match_error': min_error,
                    'standard_vector': best_match
                })
                return classification
        
        # If no standard match found but non-standard vectors are allowed
        if self.allow_non_standard:
            classification.update({
                'dislocation_type': 'non_standard',
                'family': f'{local_structure}_non_standard' if local_structure != 'unknown' else 'unknown'
            })
        
        return classification
    
    def _find_best_match(self, vector: np.ndarray, standard_vectors: List[np.ndarray]) -> tuple:
        """Find the best matching standard vector"""
        min_error = float('inf')
        best_match = None
        
        for std_vector in standard_vectors:
            # Try both orientations
            error1 = np.linalg.norm(vector - std_vector)
            error2 = np.linalg.norm(vector + std_vector)
            error = min(error1, error2)
            
            if error < min_error:
                min_error = error
                best_match = std_vector if error1 < error2 else -std_vector
        
        return best_match, min_error
    
    def _detect_local_structure(self, burgers_vector: np.ndarray) -> str:
        """
        Attempt to detect crystal structure based on Burgers vector characteristics
        """
        magnitude = np.linalg.norm(burgers_vector)
        a = self.lattice_parameter
        
        # Check common FCC signatures
        if abs(magnitude - a/2 * np.sqrt(2)) < self.tolerance:  # <110>/2 type
            return 'fcc'
        elif abs(magnitude - a/6 * np.sqrt(6)) < self.tolerance:  # <112>/6 type
            return 'fcc'
        
        # Check common BCC signatures
        elif abs(magnitude - a/2 * np.sqrt(3)) < self.tolerance:  # <111>/2 type
            return 'bcc'
        elif abs(magnitude - a/2) < self.tolerance:  # <100>/2 type
            return 'bcc'
        
        # Check common HCP signatures
        elif abs(magnitude - a) < self.tolerance:  # <10-10> type
            return 'hcp'
        elif abs(magnitude - a/3) < self.tolerance:  # <10-10>/3 type
            return 'hcp'
        
        # Default to the specified crystal type or unknown
        return self.crystal_type if magnitude > 0.1 * a else 'unknown'
    
    def analyze_loop_structure(self, loop: List[int], positions: np.ndarray, 
                             ptm_types: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """
        Analyze the local crystal structure around a dislocation loop
        """
        if ptm_types is None:
            return {'dominant_structure': self.crystal_type, 'structure_fractions': {}}
        
        # Map PTM type IDs to structure names
        structure_map = {0: 'unknown', 1: 'fcc', 2: 'hcp', 3: 'bcc', 4: 'ico', 5: 'sc'}
        
        # Count structure types in the loop
        structure_counts = {}
        for atom_id in loop:
            if atom_id < len(ptm_types):
                struct_type = structure_map.get(ptm_types[atom_id], 'unknown')
                structure_counts[struct_type] = structure_counts.get(struct_type, 0) + 1
        
        total_atoms = len(loop)
        structure_fractions = {k: v/total_atoms for k, v in structure_counts.items()}
        
        # Determine dominant structure
        dominant_structure = max(structure_counts, key=structure_counts.get) if structure_counts else 'unknown'
        
        return {
            'dominant_structure': dominant_structure,
            'structure_fractions': structure_fractions,
            'structure_counts': structure_counts,
            'total_atoms': total_atoms
        }

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
        pbc: List[bool] = [True, True, True]
    ):
        self.crystal_type = crystal_type
        self.lattice_parameter = lattice_parameter
        self.tolerance = tolerance
        self.validation_tolerance = validation_tolerance
        
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
        
        logger.info(f'UnifiedBurgersValidator initialized: {crystal_type}, '
                   f'a={lattice_parameter:.3f} Å, tol={tolerance:.3f}')
    
    def validate_burgers_vectors(
        self,
        primary_burgers: Dict[int, np.ndarray],
        loops: List[List[int]],
        positions: np.ndarray,
        displacement_field: Dict[int, np.ndarray],
        connectivity: Dict[int, List[int]]
    ) -> Dict[str, Any]:
        logger.info(f'Validating {len(primary_burgers)} Burgers vectors')
        
        # Step 1: Primary validation (normalization)
        primary_validation = self._validate_primary_burgers(primary_burgers)
        
        # Step 2: Secondary validation (elastic mapping)
        secondary_validation = self._validate_with_elastic_mapping(
            primary_burgers, loops, positions, displacement_field, connectivity
        )
        
        # Step 3: Cross-validation consistency check
        consistency_metrics = self._compute_consistency_metrics(
            primary_validation, secondary_validation
        )
        
        # Step 4: Final validated set
        final_validated = self._create_final_validation(
            primary_validation, secondary_validation, consistency_metrics
        )
        
        logger.info(f'Validation complete: {len(final_validated["valid_loops"])} valid loops '
                   f'(consistency: {consistency_metrics["overall_consistency"]:.2f})')
        
        return {
            'primary_validation': primary_validation,
            'secondary_validation': secondary_validation,
            'consistency_metrics': consistency_metrics,
            'final_validation': final_validated
        }
    
    def _validate_primary_burgers(self, burgers_vectors: Dict[int, np.ndarray]) -> Dict[str, Any]:
        validated_loops = []
        normalized_burgers = {}
        validation_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0, 'zero': 0}
        magnitudes = []
        
        for loop_id, burger_vector in burgers_vectors.items():
            magnitude = np.linalg.norm(burger_vector)
            magnitudes.append(magnitude)
            
            if magnitude > 1e-5:
                # Normalize to crystallographic form
                normalized, b_type, distance = self.normalizer.normalize_burgers_vector(burger_vector)
                
                # Store normalized vector
                normalized_burgers[loop_id] = normalized
                validation_stats[b_type] += 1
                
                # Validate magnitude is physically reasonable
                validation_metrics = self.normalizer.validate_burgers_magnitude(burger_vector)
                
                if (validation_metrics['is_realistic_perfect'] or 
                    validation_metrics['is_realistic_partial']):
                    validated_loops.append(loop_id)
            else:
                validation_stats['zero'] += 1
        
        return {
            'valid_loops': validated_loops,
            'normalized_burgers': normalized_burgers,
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

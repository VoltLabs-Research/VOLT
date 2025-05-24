from typing import Tuple, Dict
from fractions import Fraction
import logging
import numpy as np

logger = logging.getLogger(__name__)

class BurgersNormalizer:
    '''
    Standardized Burgers vector normalization and classification
    '''
    # Standard FCC Burgers vectors (normalized by lattice parameter)
    FCC_PERFECT_VECTORS = np.array([
        # <110> perfect dislocations
        [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0],
        [1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1],
        [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1]
    ]) * 0.5

    FCC_PARTIAL_VECTORS = np.array([
        # <112> Shockley partials
        [1, 1, -2], [1, -1, 2], [-1, 1, 2], [-1, -1, -2],
        [1, -2, 1], [1, 2, -1], [-1, 2, 1], [-1, -2, -1],
        [-2, 1, 1], [2, 1, -1], [2, -1, 1], [-2, -1, -1],
        [1, 1, 2], [1, -1, -2], [-1, 1, -2], [-1, -1, 2],
        [1, 2, 1], [1, -2, -1], [-1, -2, 1], [-1, 2, -1],
        [2, 1, 1], [-2, 1, -1], [-2, -1, 1], [2, -1, -1]
    ]) / 6.0

    # Standard BCC Burgers vectors 
    BCC_PERFECT_VECTORS = np.array([
        # <111> perfect dislocations
        [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1],
        [-1, -1, 1], [-1, 1, -1], [1, -1, -1], [-1, -1, -1]
    ]) * 0.5

    def __init__(
        self,
        crystal_type: str = 'fcc',
        lattice_parameter: float = 1.0,
        tolerance: float = 0.15
    ):
        self.crystal_type = crystal_type.lower()
        self.lattice_parameter = lattice_parameter
        self.tolerance = tolerance * lattice_parameter

        # Scale ideal vectors by lattice parameters
        if self.crystal_type == 'fcc':
            self.perfect_vectors = self.FCC_PERFECT_VECTORS * lattice_parameter
            self.partial_vectors = self.FCC_PARTIAL_VECTORS * lattice_parameter
        elif self.crystal_type == 'bcc':
            self.perfect_vectors = self.BCC_PERFECT_VECTORS * lattice_parameter
            # BCC doesn't have standard partials
            self.partial_vectors = np.array([])
        else:
            raise ValueError(f'Unsupported crystal type: {crystal_type}')
        logger.info(f'Initialized Burgers normalizer for {crystal_type.upper()} with a={lattice_parameter:.3f} Å')

    def normalize_burgers_vector(
        self, 
        burgers_vector: np.ndarray
    ) -> Tuple[np.ndarray, str, float]:
        burgers_vector = np.asarray(burgers_vector, dtype=np.float64)
        magnitude = np.linalg.norm(burgers_vector)
        
        if magnitude < 1e-8:
            return np.zeros(3), 'zero', 0.0
        
        best_vector = None
        best_type = 'unmapped'
        min_distance = float('inf')
        
        # Check perfect dislocations first
        for ideal_vector in self.perfect_vectors:
            # Check both directions
            for sign in [1, -1]:
                test_vector = sign * ideal_vector
                distance = np.linalg.norm(burgers_vector - test_vector)
                
                if distance < min_distance and distance < self.tolerance:
                    min_distance = distance
                    best_vector = test_vector.copy()
                    best_type = 'perfect'
        
        # Check partial dislocations if no perfect match found
        if best_type == 'unmapped' and len(self.partial_vectors) > 0:
            for ideal_vector in self.partial_vectors:
                # Check both directions
                for sign in [1, -1]:
                    test_vector = sign * ideal_vector
                    distance = np.linalg.norm(burgers_vector - test_vector)
                    
                    if distance < min_distance and distance < self.tolerance:
                        min_distance = distance
                        best_vector = test_vector.copy()
                        best_type = 'partial'
        
        # If no ideal match found, return the original vector
        if best_vector is None:
            best_vector = burgers_vector.copy()
            min_distance = magnitude
        
        return best_vector, best_type, min_distance
    
    def burgers_to_string(
        self, 
        burgers_vector: np.ndarray, 
        use_crystallographic: bool = True
    ) -> str:
        if use_crystallographic:
            # Normalize to crystallographic form
            normalized, _, _ = self.normalize_burgers_vector(burgers_vector)
            vector = normalized / self.lattice_parameter  # Normalize by lattice parameter
        else:
            vector = burgers_vector
        
        # Convert to fractions and find common denominator
        fractions = [Fraction(component).limit_denominator(12) for component in vector]
        denominators = [f.denominator for f in fractions]
        
        if all(d == 1 for d in denominators):
            # Integer case
            numerators = [int(f) for f in fractions]
            return f"[{numerators[0]} {numerators[1]} {numerators[2]}]"
        else:
            # Fractional case
            common_den = np.lcm.reduce(denominators)
            numerators = [int(f * common_den) for f in fractions]
            return f"1/{common_den}[{numerators[0]} {numerators[1]} {numerators[2]}]"
    
    def validate_burgers_magnitude(self, burgers_vector: np.ndarray) -> Dict[str, float]:
        magnitude = np.linalg.norm(burgers_vector)
        
        # Expected ranges based on crystal type
        if self.crystal_type == 'fcc':
            # |1/2<110>|
            perfect_magnitude = self.lattice_parameter * np.sqrt(2) / 2
            # |1/6<112>|
            partial_magnitude = self.lattice_parameter * np.sqrt(6) / 6
        elif self.crystal_type == 'bcc':
            # |1/2<111>|
            perfect_magnitude = self.lattice_parameter * np.sqrt(3) / 2
            # No standard partials
            partial_magnitude = 0.0 
        else:
            perfect_magnitude = partial_magnitude = 0.0
        
        return {
            'magnitude': magnitude,
            'expected_perfect': perfect_magnitude,
            'expected_partial': partial_magnitude,
            'perfect_ratio': magnitude / perfect_magnitude if perfect_magnitude > 0 else 0.0,
            'partial_ratio': magnitude / partial_magnitude if partial_magnitude > 0 else 0.0,
            'is_realistic_perfect': 0.8 <= (magnitude / perfect_magnitude) <= 1.2 if perfect_magnitude > 0 else False,
            'is_realistic_partial': 0.8 <= (magnitude / partial_magnitude) <= 1.2 if partial_magnitude > 0 else False,
        }
    
    def classify_dislocation_type(
        self,
        burgers_vector: np.ndarray, 
        line_direction: np.ndarray
    ) -> str:
        b_mag = np.linalg.norm(burgers_vector)
        l_mag = np.linalg.norm(line_direction)
        
        if b_mag < 1e-8 or l_mag < 1e-8:
            return 'undefined'
        
        # Compute angle between Burgers vector and line direction
        cos_angle = np.abs(np.dot(burgers_vector, line_direction)) / (b_mag * l_mag)
        # Handle numerical errors
        cos_angle = min(cos_angle, 1.0)
        
        # Classification thresholds (similar to OVITO)
        if cos_angle > 0.8:
            return 'screw'
        elif cos_angle < 0.2:
            return 'edge'
        else:
            return 'mixed'
        
def create_burgers_validation_report(
    burgers_vectors: Dict[int, np.ndarray],
    normalizer: BurgersNormalizer
) -> Dict:
    report = {
        'total_loops': len(burgers_vectors),
        'perfect_count': 0,
        'partial_count': 0,
        'unmapped_count': 0,
        'zero_count': 0,
        'magnitude_stats': [],
        'normalized_vectors': {},
        'string_representations': {},
        'validation_metrics': {}
    }
    
    for loop_id, burgers in burgers_vectors.items():
        normalized, b_type, distance = normalizer.normalize_burgers_vector(burgers)
        string_repr = normalizer.burgers_to_string(normalized)
        validation = normalizer.validate_burgers_magnitude(burgers)
        
        # Update counts
        if b_type == 'perfect':
            report['perfect_count'] += 1
        elif b_type == 'partial':
            report['partial_count'] += 1
        elif b_type == 'zero':
            report['zero_count'] += 1
        else:
            report['unmapped_count'] += 1
        
        # Store results
        report['normalized_vectors'][loop_id] = normalized
        report['string_representations'][loop_id] = string_repr
        report['validation_metrics'][loop_id] = validation
        report['magnitude_stats'].append(validation['magnitude'])
    
    # Compute summary statistics
    if report['magnitude_stats']:
        magnitudes = np.array(report['magnitude_stats'])
        report['magnitude_mean'] = float(np.mean(magnitudes))
        report['magnitude_std'] = float(np.std(magnitudes))
        report['magnitude_min'] = float(np.min(magnitudes))
        report['magnitude_max'] = float(np.max(magnitudes))
    
    # Classification ratios
    total = report['total_loops']
    if total > 0:
        report['perfect_ratio'] = report['perfect_count'] / total
        report['partial_ratio'] = report['partial_count'] / total
        report['unmapped_ratio'] = report['unmapped_count'] / total
    
    logger.info(f"Burgers vector validation: {report['perfect_count']} perfect, "
                f"{report['partial_count']} partial, {report['unmapped_count']} unmapped "
                f"out of {total} total loops")
    
    return report
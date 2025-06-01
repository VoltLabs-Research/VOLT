from typing import Tuple, Dict, Optional
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

    # Standard HCP Burgers vectors
    HCP_PERFECT_VECTORS = np.array([
        # <10-10> perfect dislocations (basal slip)
        [1, 0, 0], [-1/2, np.sqrt(3)/2, 0], [-1/2, -np.sqrt(3)/2, 0]
    ])

    HCP_PARTIAL_VECTORS = np.array([
        # <10-10>/3 partial dislocations 
        [1, 0, 0], [-1/2, np.sqrt(3)/2, 0], [-1/2, -np.sqrt(3)/2, 0]
    ]) / 3.0

    def __init__(
        self,
        crystal_type: str = 'fcc',
        lattice_parameter: float = 1.0,
        tolerance: float = 0.15
    ):
        '''
        Initialize a BurgersNormalizer for a given crystal

        Args:
            crystal_type (str): 'fcc', 'bcc', or 'hcp'.
            lattice_parameter (float): Lattice constant a (in Å or arbitrary units).
            tolerance (float): Fraction of lattice parameter used as distance tolerance.
        Raises:
            ValueError: If crystal_type is unsupported or numerical parameters are invalid.
        '''
        self.crystal_type = crystal_type.lower()
        
        if lattice_parameter <= 0:
            raise ValueError('Lattice parameter must be positive.')
        
        if tolerance < 0:
            raise ValueError('Tolerance cannot be negative.')

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
        elif self.crystal_type == 'hcp':
            self.perfect_vectors = self.HCP_PERFECT_VECTORS * lattice_parameter
            self.partial_vectors = self.HCP_PARTIAL_VECTORS * lattice_parameter
        else:
            raise ValueError(f'Unsupported crystal type: {crystal_type}')
        logger.info(f'Initialized Burgers normalizer for {crystal_type.upper()} with a={lattice_parameter:.3f} Å')

    def normalize_burgers_vector(
        self, 
        burgers_vector: np.ndarray
    ) -> Tuple[np.ndarray, str, float]:
        '''
        Map an arbitrary Burgers vector to the nearest ideal Burgers vector (perfect or partial),
        within the given tolerance. If no ideal vector is within tolerance, returns the original.

        Args:
            burgers_vector (np.ndarray): 3-element array representing the Burgers vector.

        Returns:
            Tuple[np.ndarray, str, float]:
              - normalized_vector (np.ndarray): Ideal Burgers vector matched (or original if unmapped or zero).
              - type_label (str): One of 'perfect', 'partial', 'unmapped', or 'zero'.
              - distance (float): Euclidean distance between the input and the matched ideal vector,
                                  or the magnitude if unmatched.
        '''
        arr = np.asarray(burgers_vector, dtype=np.float64).ravel()
        if arr.shape != (3, ):
            raise ValueError('burgers_vector must be a 3-element array.')

        if not np.isfinite(arr).all():
            raise ValueError('burgers_vector contains NaN or infinite values.')
        
        magnitude = np.linalg.norm(burgers_vector)
        
        if magnitude < 1e-8:
            return np.zeros(3), 'zero', 0.0
        
        best_vector: Optional[np.ndarray] = None
        best_type = 'unmapped'
        min_distance = np.inf

        # Preare array of all ideal vectors (including both signs) for vectorized distance
        ideal_list = []
        type_list = []

        # Perfect vectors (both signs)
        for vector in self.perfect_vectors:
            ideal_list.append(vector)
            ideal_list.append(-vector)
            type_list.append('perfect')
            type_list.append('perfect')
        
        for vector in self.partial_vectors:
            ideal_list.append(vector)
            ideal_list.append(-vector)
            type_list.append('partial')
            type_list.append('partial')

        if len(ideal_list) == 0:
            raise RuntimeError('No ideal Burgers vectors defined for this crystal.')

        # shape (N_ideals, 3)
        ideals = np.vstack(ideal_list)
        distances = np.linalg.norm(ideals - arr, axis=1)
        idx = np.argmin(distances)
        min_distance = float(distances[idx])

        if min_distance < self.tolerance:
            best_vector = ideals[idx].copy()
            best_type = type_list[idx]
            best_distance = min_distance
        else:
            best_vector = arr.copy()
            best_distance = magnitude
        
        return best_vector, best_type, best_distance
    
    def burgers_to_string(
        self, 
        burgers_vector: np.ndarray, 
        use_crystallographic: bool = True
    ) -> str:
        '''
        Convert a Burgers vector into a string in crystallographic notation.
        If use_crystallographic is True, the vector is first snapped to the nearest ideal vector.

        Args:
            burgers_vector (np.ndarray): 3-element array of the Burgers vector.
            use_crystallographic (bool): Whether to normalize to an ideal vector before formatting.

        Returns:
            str: Formatted string, e.g. "[1 1 0]" or "1/2[1 1 0]".
        '''
        arr = np.asarray(burgers_vector, dtype=np.float64).ravel()
        
        if arr.shape != (3, ):
            raise ValueError('burgers_vector must be a 3-element array.')
        
        if not np.isfinite(arr).all():
            raise ValueError('burgers_vector contains NaN or infinite values.')

        if use_crystallographic:
            # Normalize to crystallographic form
            normalized, _, _ = self.normalize_burgers_vector(arr)
            # Normalize by lattice parameter
            vector = normalized / self.lattice_parameter
        else:
            vector = arr

        # Reduce each component to a Fraction
        fractions = [Fraction(component).limit_denominator(12) for component in vector]
        denominators = [f.denominator for f in fractions]
        numerators = [f.numerator for f in fractions]

        # Simplify by greatest common divisor of numerators if all denominators equals 1
        if all(denominator == 1 for denominator in denominators):
            # Integers: "[n1 n2 n3]"
            return f'[{numerators[0]} {numerators[1]} {numerators[2]}]'
        else:
            # Find least common multiple of denominators
            common_denominator = np.lcm.reduce(denominators)
            scaled_nums = [int(f * common_denominator) for f in fractions]
            # Reduce the bracket prefactor if possible
            gcd_numerators = np.gcd.reduce(scaled_nums + [common_denominator])
            common_denominator //= gcd_numerators
            scaled_nums = [numerator // gcd_numerators for numerator in scaled_nums]
            if common_denominator == 1:
                # Became integer after reduction
                return f'[{scaled_nums[0]} {scaled_nums[1]} {scaled_nums[2]}]'
            return f'1/{common_denominator}[{scaled_nums[0]} {scaled_nums[1]} {scaled_nums[2]}]'
    
    def validate_burgers_magnitude(self, burgers_vector: np.ndarray) -> Dict[str, float]:
        '''
        Compute magnitude statistics and compare against expected ideal magnitudes
        for perfect and partial dislocations based on crystal type.

        Args:
            burgers_vector (np.ndarray): 3-element array of the Burgers vector.

        Returns:
            Dict[str, Optional[float]]: 
              - 'magnitude': Actual magnitude of the input Burgers vector.
              - 'expected_perfect': Ideal perfect magnitude for this crystal.
              - 'expected_partial': Ideal partial magnitude, or None if not applicable.
              - 'perfect_ratio': magnitude / expected_perfect (or None).
              - 'partial_ratio': magnitude / expected_partial (or None).
              - 'is_realistic_perfect': True if ratio ∈ [0.8, 1.2], else False.
              - 'is_realistic_partial': True if ratio ∈ [0.8, 1.2], else False.
        '''
        arr = np.asarray(burgers_vector, dtype=np.float64).ravel()

        if arr.shape != (3, ):
            raise ValueError('burgers_vector must be a 3-element array.')

        if not np.isfinite(arr).all():
            raise ValueError('burgers_vector contains NaN or infinite values.')

        magnitude = float(np.linalg.norm(arr))

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
        elif self.crystal_type == 'hcp':
            # |<10-10>| (basal slip)
            perfect_magnitude = self.lattice_parameter
            # |<10-10>/3| (partial dislocations)
            partial_magnitude = self.lattice_parameter / 3
        else:
            perfect_magnitude = partial_magnitude = 0.0
        
        def ratio(value: float, denominator) -> Optional[float]:
            return float(value / denominator) if (denominator > 0) else None
        perfect_ratio = ratio(magnitude, perfect_magnitude)
        partial_ratio = ratio(magnitude, partial_magnitude)

        is_realistic_perfect = (
            0.8 <= perfect_ratio <= 1.2
            if perfect_ratio is not None else False
        )

        is_realistic_partial = (
            0.8 <= partial_ratio <= 1.2
            if partial_ratio is not None else False
        )

        return {
            'magnitude': magnitude,
            'expected_perfect': perfect_magnitude,
            'expected_partial': partial_magnitude,
            'perfect_ratio': perfect_ratio,
            'partial_ratio': partial_ratio,
            'is_realistic_perfect': is_realistic_perfect,
            'is_realistic_partial': is_realistic_partial
        }
    
    def classify_dislocation_type(
        self,
        burgers_vector: np.ndarray, 
        line_direction: np.ndarray
    ) -> str:
        '''
        Classify dislocation character (edge, screw, or mixed) based on the angle 
        between the Burgers vector and the line direction.

        Args:
            burgers_vector (np.ndarray): 3-element array of the Burgers vector.
            line_direction (np.ndarray): 3-element array representing direction tangent.

        Returns:
            str: One of 'edge', 'screw', 'mixed', or 'undefined' (if zero-length vectors).
        '''
        b = np.asarray(burgers_vector, dtype=np.float64).ravel()
        l = np.asarray(line_direction, dtype=np.float64).ravel()
        if b.shape != (3, ) or l.shape != (3, ):
            raise ValueError('burgers_vector and line_direction must be 3-element arrays.')

        if not (np.isfinite(b).all() and np.isfinite(l).all()):
            raise ValueError('burgers_vector or line_direction contains NaN/infinite values.')

        b_mag = np.linalg.norm(b)
        l_mag = np.linalg.norm(l)
        if b_mag < 1e-8 or l_mag < 1e-8:
            return 'undefined'

        # Normalize both
        b_unit = b / b_mag
        l_unit = l / l_mag

        cos_angle = abs(np.dot(b_unit, l_unit))
        cos_angle = min(cos_angle, 1.0)

        if cos_angle > 0.8:
            return 'screw'
        elif cos_angle < 0.2:
            return 'edge'
        else:
            return 'mixed'

def create_burgers_validation_report(
    burgers_vectors: Dict[int, np.ndarray],
    line_directions: Dict[int, np.ndarray],
    normalizer: BurgersNormalizer
) -> Dict:
    """
    Generate a summary report for a collection of Burgers vectors, 
    normalizing each to ideal values, computing validation metrics, and classifying dislocation character.

    Args:
        burgers_vectors (Dict[int, np.ndarray]): Mapping from loop ID to raw Burgers vector.
        line_directions (Dict[int, np.ndarray]): Mapping from loop ID to line direction vector.
        normalizer (BurgersNormalizer): Instance used to normalize, validate, and classify vectors.

    Returns:
        Dict: 
          - 'total_loops': Number of loops processed.
          - 'perfect_count': Count of perfect matches.
          - 'partial_count': Count of partial matches.
          - 'unmapped_count': Count of vectors outside tolerance.
          - 'zero_count': Count of near-zero Burgers vectors.
          - 'magnitude_stats': List of raw magnitudes.
          - 'normalized_vectors': Dict mapping loop ID to normalized vector.
          - 'string_representations': Dict mapping loop ID to formatted string.
          - 'validation_metrics': Dict mapping loop ID to magnitude validation dict.
          - 'character': Dict mapping loop ID to 'edge', 'screw', 'mixed', or 'undefined'.
          - 'magnitude_mean': Mean magnitude (if any).
          - 'magnitude_std': Standard deviation of magnitudes (if any).
          - 'magnitude_min': Minimum magnitude (if any).
          - 'magnitude_max': Maximum magnitude (if any).
          - 'perfect_ratio': perfect_count / total_loops (if total_loops > 0).
          - 'partial_ratio': partial_count / total_loops.
          - 'unmapped_ratio': unmapped_count / total_loops.
    """
    report: Dict = {
        'total_loops': len(burgers_vectors),
        'perfect_count': 0,
        'partial_count': 0,
        'unmapped_count': 0,
        'zero_count': 0,
        'magnitude_stats': [],
        'normalized_vectors': {},
        'string_representations': {},
        'validation_metrics': {},
        'character': {}
    }

    for loop_id, burgers in burgers_vectors.items():
        if loop_id not in line_directions:
            raise KeyError(f"Missing line direction for loop ID {loop_id}.")

        normalized, b_type, distance = normalizer.normalize_burgers_vector(burgers)
        string_repr = normalizer.burgers_to_string(normalized)
        validation = normalizer.validate_burgers_magnitude(burgers)
        line_dir = line_directions[loop_id]
        character = normalizer.classify_dislocation_type(burgers, line_dir)

        if b_type == 'perfect':
            report['perfect_count'] += 1
        elif b_type == 'partial':
            report['partial_count'] += 1
        elif b_type == 'zero':
            report['zero_count'] += 1
        else:
            report['unmapped_count'] += 1

        report['normalized_vectors'][loop_id] = normalized
        report['string_representations'][loop_id] = string_repr
        report['validation_metrics'][loop_id] = validation
        report['character'][loop_id] = character
        report['magnitude_stats'].append(validation['magnitude'])

    # Summary statistics for magnitudes
    if report['magnitude_stats']:
        mags = np.array(report['magnitude_stats'], dtype=float)
        report['magnitude_mean'] = float(np.mean(mags))
        report['magnitude_std'] = float(np.std(mags))
        report['magnitude_min'] = float(np.min(mags))
        report['magnitude_max'] = float(np.max(mags))

    total = report['total_loops']
    if total > 0:
        report['perfect_ratio'] = report['perfect_count'] / total
        report['partial_ratio'] = report['partial_count'] / total
        report['unmapped_ratio'] = report['unmapped_count'] / total

    logger.info(
        f"Burgers vector validation: {report['perfect_count']} perfect, "
        f"{report['partial_count']} partial, {report['unmapped_count']} unmapped, "
        f"{report['zero_count']} zero out of {total} total loops"
    )

    return report
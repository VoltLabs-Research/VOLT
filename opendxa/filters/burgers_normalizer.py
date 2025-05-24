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
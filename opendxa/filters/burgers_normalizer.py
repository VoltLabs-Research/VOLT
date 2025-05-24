from typing import Tuple, Dict
from fractions import Fraction
import logging
import numpy as np

logger = logging.getLogger(__name__)

class BurgersNormalizer:
    '''
    Standardized Burgers vector normalization and classification
    '''
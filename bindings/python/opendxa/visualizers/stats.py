from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class DislocationStats:
    num_segments: int
    total_points: int
    total_length: float
    average_length: float
    max_length: float
    min_length: float
    burgers_magnitudes: List[float]
    unique_burgers_magnitudes: List[float]
    fractional_burgers: List[str]
    segment_info: List[Dict[str, Any]]
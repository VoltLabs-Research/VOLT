from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class NetworkStatistics:
    """Network-level statistics from DXA analysis."""
    total_network_length: float
    segment_count: int
    junction_count: int
    dangling_segments: int
    average_segment_length: float
    density: float
    total_segments_including_degenerate: int

@dataclass
class JunctionInformation:
    """Junction information from DXA analysis."""
    total_junctions: int
    junction_arm_distribution: Dict[int, int]

@dataclass
class CircuitInformation:
    """Circuit information from DXA analysis."""
    total_circuits: int
    dangling_circuits: int
    blocked_circuits: int
    average_edge_count: float
    edge_count_range: Dict[str, int]

@dataclass
class SegmentDetailedInfo:
    """Detailed information for a single dislocation segment."""
    segment_id: int
    fractional_burgers: str
    length: float
    burgers_magnitude: float
    core_sizes: List[int]
    average_core_size: float
    is_closed_loop: bool
    is_infinite_line: bool
    line_direction_string: str
    junction_info: Dict[str, Any]
    node_info: Dict[str, Any]
    circuit_info: Dict[str, Any]

@dataclass
class DislocationStats:
    """Comprehensive dislocation statistics from DXA analysis."""
    # Basic statistics
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
    
    # Enhanced statistics from detailed export
    network_statistics: Optional[NetworkStatistics] = None
    junction_information: Optional[JunctionInformation] = None
    circuit_information: Optional[CircuitInformation] = None
    detailed_segment_info: Optional[List[SegmentDetailedInfo]] = None
    metadata: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ProcessPoolExecutor
import orjson

from opendxa.stats.dislocation_stats import (
    DislocationStats, 
    NetworkStatistics, 
    JunctionInformation, 
    CircuitInformation,
    SegmentDetailedInfo
)

def compute_stats_static(analysis: Dict[str, Any]) -> DislocationStats:
    """Compute enhanced dislocation statistics from analysis data."""
    if 'dislocations' not in analysis:
        return _empty_stats()
    
    dislocations_data = analysis['dislocations']
    segments = dislocations_data.get('data', [])
    summary = dislocations_data.get('summary', {})
    metadata = dislocations_data.get('metadata', {})
    
    if not segments:
        return _empty_stats()
    
    # Basic statistics
    total_length = 0.0
    total_points = 0
    min_length = float('inf')
    max_length = 0.0
    
    burgers = []
    fractional = []
    unique_burgers = set()
    segment_info = []
    detailed_segment_info = []

    for seg in segments:
        # Basic segment data
        length = seg.get('length', 0.0)
        total_length += length
        min_length = min(min_length, length)
        max_length = max(max_length, length)

        burgers_info = seg.get('burgers', {})
        mag = burgers_info.get('magnitude', 0.0)
        frac = burgers_info.get('fractional', '')
        
        burgers.append(mag)
        fractional.append(frac)
        unique_burgers.add(mag)

        total_points += seg.get('num_points', len(seg.get('points', [])))

        # Basic segment info
        segment_info.append({
            'segment_id': seg.get('index', 0),
            'length': length,
            'burgers_magnitude': mag,
            'fractional_burgers': frac
        })
        
        # Detailed segment info
        detailed_info = SegmentDetailedInfo(
            segment_id=seg.get('index', 0),
            fractional_burgers=frac,
            length=length,
            burgers_magnitude=mag,
            core_sizes=seg.get('core_sizes', []),
            average_core_size=seg.get('average_core_size', 0.0),
            is_closed_loop=seg.get('is_closed_loop', False),
            is_infinite_line=seg.get('is_infinite_line', False),
            line_direction_string=seg.get('line_direction', {}).get('string', ''),
            junction_info=seg.get('junction_info', {}),
            node_info=seg.get('nodes', {}),
            circuit_info={
                'forward_circuit': seg.get('forward_circuit', {}),
                'backward_circuit': seg.get('backward_circuit', {})
            }
        )
        detailed_segment_info.append(detailed_info)

    num = len(segments)
    if num == 0:
        min_length = 0.0
    
    # Extract network statistics if available
    network_stats = None
    if 'network_statistics' in analysis:
        net_data = analysis['network_statistics']
        network_stats = NetworkStatistics(
            total_network_length=net_data.get('total_network_length', total_length),
            segment_count=net_data.get('segment_count', num),
            junction_count=net_data.get('junction_count', 0),
            dangling_segments=net_data.get('dangling_segments', 0),
            average_segment_length=net_data.get('average_segment_length', total_length/num if num else 0.0),
            density=net_data.get('density', 0.0),
            total_segments_including_degenerate=net_data.get('total_segments_including_degenerate', num)
        )
    
    # Extract junction information if available
    junction_info = None
    if 'junction_information' in analysis:
        junc_data = analysis['junction_information']
        arm_dist = junc_data.get('junction_arm_distribution', {})
        
        # Convert list format to dict if needed
        if isinstance(arm_dist, list):
            arm_dict = {}
            for item in arm_dist:
                if isinstance(item, list) and len(item) == 2:
                    arms, count = item
                    arm_dict[arms] = count
            arm_dist = arm_dict
        
        junction_info = JunctionInformation(
            total_junctions=junc_data.get('total_junctions', 0),
            junction_arm_distribution=arm_dist
        )
    
    # Extract circuit information if available
    circuit_info = None
    if 'circuit_information' in analysis:
        circ_data = analysis['circuit_information']
        circuit_info = CircuitInformation(
            total_circuits=circ_data.get('total_circuits', 0),
            dangling_circuits=circ_data.get('dangling_circuits', 0),
            blocked_circuits=circ_data.get('blocked_circuits', 0),
            average_edge_count=circ_data.get('average_edge_count', 0.0),
            edge_count_range=circ_data.get('edge_count_range', {'min': 0, 'max': 0})
        )

    return DislocationStats(
        num_segments=num,
        total_points=total_points,
        total_length=total_length,
        average_length=(total_length/num) if num else 0.0,
        max_length=max_length,
        min_length=min_length,
        burgers_magnitudes=burgers,
        unique_burgers_magnitudes=sorted(unique_burgers),
        fractional_burgers=fractional,
        segment_info=segment_info,
        network_statistics=network_stats,
        junction_information=junction_info,
        circuit_information=circuit_info,
        detailed_segment_info=detailed_segment_info,
        metadata=metadata,
        summary=summary
    )

def _empty_stats() -> DislocationStats:
    """Return empty stats for error cases."""
    return DislocationStats(
        num_segments=0,
        total_points=0,
        total_length=0.0,
        average_length=0.0,
        max_length=0.0,
        min_length=0.0,
        burgers_magnitudes=[],
        unique_burgers_magnitudes=[],
        fractional_burgers=[],
        segment_info=[]
    )

def _load_and_compute(path: Path) -> DislocationStats:
    data = orjson.loads(path.read_bytes())
    return compute_stats_static(data)

class DislocationStatsAggregator:
    def __init__(self, source: str, pattern: str = '*.json'):
        self.source = Path(source)
        self.pattern = pattern

    def _get_paths(self) -> List[Path]:
        if self.source.is_file():
            return [self.source]
        return sorted(self.source.glob(self.pattern))

    def compute_all_parallel(self) -> List[DislocationStats]:
        paths = self._get_paths()
        with ProcessPoolExecutor() as exe:
            return list(exe.map(_load_and_compute, paths))

    def compute_global(self) -> DislocationStats:
        stats_list = self.compute_all_parallel()

        total_segments = sum(s.num_segments for s in stats_list)
        total_points = sum(s.total_points for s in stats_list)
        total_length = sum(s.total_length for s in stats_list)

        all_lengths = [info['length']
                       for s in stats_list
                       for info in s.segment_info]

        all_burgers   = [b for s in stats_list for b in s.burgers_magnitudes]
        all_fractional= [f for s in stats_list for f in s.fractional_burgers]

        avg_length = (total_length / total_segments) if total_segments else 0.0
        min_length = min(all_lengths) if all_lengths else 0.0
        max_length = max(all_lengths) if all_lengths else 0.0

        return DislocationStats(
            num_segments=total_segments,
            total_points=total_points,
            total_length=total_length,
            average_length=avg_length,
            max_length=max_length,
            min_length=min_length,
            burgers_magnitudes=all_burgers,
            unique_burgers_magnitudes=sorted(set(all_burgers)),
            fractional_burgers=all_fractional,
            segment_info=[]
        )

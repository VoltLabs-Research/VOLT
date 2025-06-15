from pathlib import Path
from typing import List, Dict, Any
from concurrent.futures import ProcessPoolExecutor
import orjson

from opendxa.stats.dislocation_stats import DislocationStats

def compute_stats_static(analysis: Dict[str, Any]) -> DislocationStats:
    segments = analysis.get('dislocations', {}).get('data', [])
    
    total_length = 0.0
    total_points = 0
    min_length = float('inf')
    max_length = 0.0
    
    burgers = []
    fractional = []
    unique_burgers = set()
    segment_info = []

    for seg in segments:
        length = seg['length']
        total_length += length
        min_length = min(min_length, length)
        max_length = max(max_length, length)

        mag = seg['burgers']['magnitude']
        frac = seg['burgers']['fractional']
        burgers.append(mag)
        fractional.append(frac)
        unique_burgers.add(mag)

        total_points += seg['num_points']

        segment_info.append({
            'segment_id': seg['index'],
            'length': length,
            'burgers_magnitude': mag,
            'fractional_burgers': frac
        })

    num = len(segments)
    if num == 0:
        min_length = 0.0

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
        segment_info=segment_info
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

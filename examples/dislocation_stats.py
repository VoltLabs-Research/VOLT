from opendxa.stats import DislocationStatsAggregator
from dataclasses import asdict

aggregator = DislocationStatsAggregator(
    '/home/rodyherrera/Desktop/tmp/OpenDXA/debug.analysis.sigma_9yz_analysis'
)

global_stats = aggregator.compute_global()
stats_dict = asdict(global_stats)

for key, value in stats_dict.items():
    if key == 'segment_info':
        display = global_stats.num_segments
    elif isinstance(value, (list, tuple, set)):
        display = len(value)
    else:
        display = value

    print(f'{key}: {display}')

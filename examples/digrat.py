from opendxa.digrat import DislocationTracker
from datetime import datetime

tracker = DislocationTracker()

tracker.analyze_trajectory(
    analysis_folder='/home/rodyherrera/Desktop/tmp/OpenDXA/debug.analysis.sigma_9yz_analysis',
    min_similarity=0.7,
    burgers_tolerance=0.1
)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
json_filename = f"dislocation_lineage_data.json"
tracker.export_lineage_data(json_filename)
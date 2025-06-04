from opendxa.core.analysis_config import AnalysisConfig
from opendxa.core.engine import DislocationAnalysis

config = AnalysisConfig(
    lammpstrj='/home/rodyherrera/Desktop/OpenDXA/analysis.lammpstrj',
    workers=2,
    use_cna=False,
    # ...
)

analysis = DislocationAnalysis(config)
analysis.run()
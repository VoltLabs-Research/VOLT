from pathlib import Path
from voltsdk import PluginHub

import pandas as pd
import numpy as np

hub = PluginHub()
ptm = hub.get('voltlabs@polyhedral-template-matching')
dxa = hub.get('voltlabs@opendxa')

INPUT_FILE = 'dump'
OUTPUT_DIR = 'output/ptm-dxa'

ptm_res = ptm.run(
    INPUT_FILE,
    output_base=OUTPUT_DIR,
    crystalStructure='fcc',
    rmsd=0.10
)

dxa_run = dxa.run(
    ptm_res.artifact('annotatedDump'),
    output_base=OUTPUT_DIR,
    reference_topology='fcc',
    clusters_table=ptm_res.artifact('clustersTable'),
    clusters_transitions=ptm_res.artifact('clustersTransitions')
)

with open(dxa_run.artifact('dislocations'), 'r') as f:
    payload = json.load(f)

summary_df = pd.DataFrame([payload.main_listing])

print(summary_df)
print(dislocations_df.head())
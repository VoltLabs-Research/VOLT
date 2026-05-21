# pip install voltsdk
from voltsdk import PluginHub

INPUT_FILE = 'dump'
OUTPUT_DIR = 'output/ptm-dxa'

hub = PluginHub(default_publisher='voltlabs')

ptm = hub.get('polyhedral-template-matching')
dxa = hub.get('opendxa')

ptm_run = ptm(
    INPUT_FILE,
    output_dir=OUTPUT_DIR,
    crystal_structure='FCC',
    rmsd=0.10,
)

dxa_run = dxa(
    ptm_run['annotated.dump'],
    output_dir=OUTPUT_DIR,
    reference_topology='FCC',
    clusters_table=ptm_run['clusters.table'],
    clusters_transitions=ptm_run['cluster_transitions.table'],
    export_as='json',
)

dislocations = dxa_run['dislocations']
viewer_url = dislocations.open_in_volt(open_browser=False)

print(dislocations.df('main_listing'))
print(dislocations.df('sub_listings.dislocation_segments').head())
print(viewer_url)

from voltsdk import PluginHub

INPUT_FILE = 'dump'
OUTPUT_BASE = 'output/ptm-dxa'

hub = PluginHub()
ptm = hub.get('voltlabs@polyhedral-template-matching')
dxa = hub.get('voltlabs@opendxa')

ptm_run = ptm.run(
    INPUT_FILE,
    output_base=OUTPUT_BASE,
    crystal_structure='FCC',
    rmsd=0.10,
)

dxa_run = dxa.run(
    ptm_run.path('annotated.dump'),
    output_base=OUTPUT_BASE,
    reference_topology='FCC',
    clusters_table=ptm_run.path('clusters.table'),
    clusters_transitions=ptm_run.path('cluster_transitions.table'),
    export_as='json',
)

print(dxa_run.df('dislocations', 'main_listing'))
print(dxa_run.df('dislocations', 'sub_listings.dislocation_segments').head())

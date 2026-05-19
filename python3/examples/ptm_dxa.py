from voltsdk import PluginHub

hub = PluginHub()

ptm = hub.get('polyhedral-template-matching')
dxa = hub.get('opendxa')

input_file = 'timestep-50000.dump'
output_base = './output/ptm_dxa'

ptm_run = ptm.run(
    input_file,
    output_base=output_base,
    crystalStructure='FCC',
    rmsd=0.10,
)

dxa_run = dxa.run(
    ptm_run.artifact('annotatedDump') or f'{output_base}_annotated.dump',
    output_base=output_base,
    **{
        'reference-topology': 'fcc',
        'clusters-table': ptm_run.artifact('clustersTable'),
        'clusters-transitions': ptm_run.artifact('clustersTransitions'),
        'export-interface-mesh': True,
        'export-structure-identification': True,
        'export-coherent-crystalline-regions': True,
    },
)

print(dxa_run.artifact('dislocations.msgpack'))

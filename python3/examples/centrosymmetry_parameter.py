from voltsdk import PluginHub

hub = PluginHub()

plugin = hub.get('centrosymmetry-parameter')
result = plugin.run(
    'timestep-50000.dump',
    output_base='output/',
    numNeighbors=12,
    mode='conventional'
)

print(result)
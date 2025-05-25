from opendxa.export import DislocationExporter
import numpy as np

def step_export(ctx, refinement):
    data = ctx['data']
    args = ctx['args']
    
    lines = refinement['refined_lines']
    loops = [line['atoms'] for line in lines]
    burgers = {i: line['burgers_vector'] for i, line in enumerate(lines)}
    line_types = [line['type'] for line in lines]
    
    exporter = DislocationExporter(
        positions=ctx['data']['positions'],
        loops=loops,
        burgers=burgers,
        timestep=data['timestep'],
        line_types=np.array(line_types)
    )
    exporter.to_json(args.output)
    ctx['logger'].info(f'Exported to {args.output}')
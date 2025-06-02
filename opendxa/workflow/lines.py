from opendxa.classification import DislocationLineBuilder, ClassificationEngine
import numpy as np

def step_dislocation_lines(ctx, advanced_loops, filtered):
    builder = DislocationLineBuilder(
        positions=filtered['positions'],
        loops=advanced_loops['loops'],
        burgers=advanced_loops['burgers'],
        threshold=0.1
    )
    lines = builder.build_lines()

    engine = ClassificationEngine(
        positions=filtered['positions'],
        loops=advanced_loops['loops'],
        burgers_vectors=advanced_loops['burgers']    
    )
    line_types = engine.classify()
    
    structured_lines = []
    for idx, line_points in enumerate(lines):
        if idx in advanced_loops['burgers']:
            structured_lines.append({
                'id': idx,
                'atoms': advanced_loops['loops'][idx],
                'positions': line_points,
                'burgers_vector': advanced_loops['burgers'][idx],
                'type': line_types[idx] if idx < len(line_types) else -1,
                'length': np.sum(np.linalg.norm(np.diff(line_points, axis=0), axis=1)) if len(line_points) > 1 else 0.0
            })
    
    ctx['logger'].info(f'Built {len(structured_lines)} structured dislocation lines')
    return structured_lines

from opendxa.classification import PTMLocalClassifier
from opendxa.neighbors import HybridNeighborFinder
import numpy as np

def step_neighbors(ctx):
    args = ctx['args']
    data = ctx['data']
    neighbor_finder = HybridNeighborFinder(
        positions=data['positions'],
        cutoff=args.cutoff,
        num_neighbors=args.num_neighbors,
        voronoi_factor=args.voronoi_factor,
        max_neighbors=args.num_neighbors * 2,
        box_bounds=data['box']
    )
    neighbors = neighbor_finder.find_neighbors()
    ctx['logger'].info(f'Found {sum(len(v) for v in neighbors.values())} neighbor pairs')
    return neighbors

def step_classify_ptm(ctx, neighbors):
    data = ctx['data']
    ptm_classifier = PTMLocalClassifier(
        positions=data['positions'],
        box_bounds=data['box'],
        neighbor_dict=neighbors,
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        max_neighbors=ctx['template_sizes'].max()
    )
    types, quats = ptm_classifier.classify()
    ctx['logger'].info(f'PTM classified: {dict(zip(*np.unique(types, return_counts=True)))}')
    return {'types': types, 'quaternions': quats, 'neighbors': neighbors}
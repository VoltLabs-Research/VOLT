from opendxa.classification import PTMLocalClassifier, CNALocalClassifier
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
    args = ctx['args']
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
    if getattr(args, 'crystal_type', None) is not None:
        crystal_type = args.crystal_type
    else:
        # infer_structure_type() - (type_name, fraction, counts)
        crystal_type, _, _ = ptm_classifier.infer_structure_type()
    return {
        'types': types, 
        'quaternions': quats, 
        'crystal_type': crystal_type,
        'neighbors': neighbors
    }

def step_classify_cna(ctx, neighbors):
    '''
    Classify local structure using Common Neighbor Analysis (CNA).
    
    This step performs structure classification using CNA algorithm instead of PTM.
    CNA is faster but less accurate than PTM for complex structures.
    '''
    data = ctx['data']
    args = ctx['args']
    
    cna_classifier = CNALocalClassifier(
        positions=data['positions'],
        box_bounds=data['box'],
        neighbor_dict=neighbors,
        cutoff_distance=args.cutoff,
        max_neighbors=args.num_neighbors * 2,
        adaptive_cutoff=args.adaptive_cutoff,
        neighbor_tolerance=args.neighbor_tolerance,
        tolerance=args.tolerance
    )
    
    types, cna_signatures = cna_classifier.classify()
    
    # CNA doesn't provide quaternions, so we create dummy quaternions
    # This maintains compatibility with the rest of the workflow
    N = len(data['positions'])
    quaternions = np.zeros((N, 4), dtype=np.float32)
    quaternions[:, 0] = 1.0 
    
    ctx['logger'].info(f'CNA classified: {dict(zip(*np.unique(types, return_counts=True)))}')
    if getattr(args, 'crystal_type', None) is not None:
        crystal_type = args.crystal_type
    else:
        # infer_structure_type() - (type_name, fraction, counts)
        crystal_type, _, _ = cna_classifier.infer_structure_type()    
    return {
        'types': types, 
        'quaternions': quaternions, 
        'crystal_type': crystal_type,
        'neighbors': neighbors,
        'cna_signatures': cna_signatures
    }


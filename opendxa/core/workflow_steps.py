from opendxa.filters import FilteredLoopFinder, LoopGrouper, LoopCanonicalizer
from opendxa.export import DislocationExporter
from opendxa.neighbors import HybridNeighborFinder
from opendxa.core.sequentials import Sequentials

from opendxa.classification import (
    PTMLocalClassifier,
    SurfaceFilter,
    LatticeConnectivityGraph,
    DisplacementFieldAnalyzer,
    BurgersCircuitEvaluator,
    ClassificationEngine,
    DislocationLineBuilder
)

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

def step_surface_filter(ctx, ptm):
    args = ctx['args']
    data = ctx['data']
    surface_filter = SurfaceFilter(min_neighbors=args.min_neighbors)
    data_filtered = surface_filter.filter_data(
        positions=data['positions'],
        ids=data['ids'],
        neighbors=ptm['neighbors'],
        ptm_types=ptm['types'],
        quaternions=ptm['quaternions']
    )
    n_interior = data_filtered['positions'].shape[0]
    ctx['logger'].info(f'Surface Filter: {n_interior} interior atoms')
    return data_filtered

def step_graph(ctx, filtered):
    args = ctx['args']
    connectivity_graph = LatticeConnectivityGraph(
        positions=filtered['positions'],
        ids=filtered['ids'],
        neighbors=filtered['neighbors'],
        ptm_types=filtered['ptm_types'],
        quaternions=filtered['quaternions'],
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        tolerance=args.tolerance
    )
    connectivity = connectivity_graph.build_graph()
    n_edges = sum(len(v) for v in connectivity.values())//2
    ctx['logger'].info(f'Graph: {n_edges} edges')
    return connectivity

def step_displacement(ctx, connectivity, filtered):
    data = ctx['data']
    analyzer = DisplacementFieldAnalyzer(
        positions=filtered['positions'],
        connectivity=connectivity,
        ptm_types=filtered['ptm_types'],
        quaternions=filtered['quaternions'],
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        box_bounds=data['box']
    )
    disp_vecs, avg_mags = analyzer.compute_displacement_field()
    ctx['logger'].info(f'Avg displacement magnitude: {np.nanmean(avg_mags):.3f}')
    return {'vectors': disp_vecs, 'mags': avg_mags}


def step_burgers_loops(ctx, connectivity, filtered):
    data = ctx['data']
    loop_finder = FilteredLoopFinder(connectivity, data['positions'], max_length=8)
    loops = loop_finder.find_minimal_loops()

    canonicalizer = LoopCanonicalizer(filtered['positions'], data['box'])
    canonical_loops = canonicalizer.canonicalize(loops)

    evaluator = BurgersCircuitEvaluator(
        connectivity=connectivity,
        positions=filtered['positions'],
        ptm_types=filtered['ptm_types'],
        quaternions=filtered['quaternions'],
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        box_bounds=data['box']
    )
    evaluator.loops = canonical_loops
    raw_burgers = evaluator.calculate_burgers()

    grouper = LoopGrouper(raw_burgers, canonical_loops, data['positions'])
    groups = grouper.group_loops()

    final_loops = []
    final_burgers = {}
    for gid, group in enumerate(groups):
        all_pts = []
        avg_burg = np.zeros(3, dtype=np.float32)
        for idx in group:
            all_pts.extend(canonical_loops[idx])
            avg_burg += raw_burgers[idx]
        avg_burg /= len(group)
        final_loops.append(sorted(set(all_pts)))
        final_burgers[gid] = avg_burg

    return {'loops': final_loops, 'burgers': final_burgers}

def step_dislocation_lines(ctx, loops, filtered):
    builder = DislocationLineBuilder(
        positions=filtered['positions'],
        loops=loops['loops'],
        burgers=loops['burgers'],
        threshold=0.1
    )
    lines = builder.build_lines()

    engine = ClassificationEngine(
        positions=filtered['positions'],
        loops=loops['loops'],
        burgers_vectors=loops['burgers']    
    )
    line_types = engine.classify()
    return {'lines': lines, 'types': line_types}

def step_export(ctx, lines, loops, filtered):
    data = ctx['data']
    args = ctx['args']
    exporter = DislocationExporter(
        positions=filtered['positions'],
        loops=loops['loops'],
        burgers=loops['burgers'],
        timestep=data['timestep'],
        line_types=lines['types']
    )
    exporter.to_json(args.output)
    ctx['logger'].info(f'Exported to {args.output}')

def create_and_configure_workflow(ctx):
    workflow = Sequentials(ctx)

    workflow.register('neighbors', step_neighbors)
    workflow.register('ptm', step_classify_ptm, depends_on=['neighbors'])
    workflow.register('filtered', step_surface_filter, depends_on=['ptm'])
    workflow.register('connectivity', step_graph, depends_on=['filtered'])
    workflow.register('displacement', step_displacement, depends_on=['connectivity', 'filtered'])
    workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
    workflow.register('lines', step_dislocation_lines, depends_on=['loops', 'filtered'])
    workflow.register('export', step_export, depends_on=['lines','loops','filtered'])

    return workflow
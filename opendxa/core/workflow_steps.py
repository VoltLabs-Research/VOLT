from opendxa.filters import FilteredLoopFinder, LoopGrouper, LoopCanonicalizer
from opendxa.export import DislocationExporter
from opendxa.neighbors import HybridNeighborFinder
from opendxa.core.sequentials import Sequentials
from scipy.spatial.distance import cdist
from filters.burgers_normalizer import BurgersNormalizer, create_burgers_validation_report

from opendxa.utils.pbc import (
    unwrap_pbc_displacement,
    compute_minimum_image_distance
)

from opendxa.classification import (
    PTMLocalClassifier,
    SurfaceFilter,
    LatticeConnectivityGraph,
    DisplacementFieldAnalyzer,
    BurgersCircuitEvaluator,
    ClassificationEngine,
    DislocationLineBuilder,
    DislocationCoreMarker,
    DislocationStatisticsGenerator,
    DislocationLineSmoother,
    ElasticMapper,
    DelaunayTessellator
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

def step_delaunay_tessellation(ctx, filtered):
    data = ctx['data']
    args = ctx['args']
    
    # Convert box bounds to numpy array for DelaunayTessellator
    box_bounds = np.array(data['box'], dtype=np.float64)

    # Force PBC on all directions
    pbc_active = [True, True, True]
    ctx['pbc_active'] = pbc_active 
    
    # Adjust ghost layer thickness based on PBC
    base_thickness = getattr(args, 'ghost_thickness', 5.0)
    if any(pbc_active):
        # Use smaller ghost layer for PBC systems to avoid artifacts
        ghost_thickness = min(base_thickness, 3.0)
    else:
        ghost_thickness = base_thickness
    
    tessellator = DelaunayTessellator(
        positions=filtered['positions'],
        box_bounds=box_bounds,
        ghost_layer_thickness=ghost_thickness
    )
    
    tessellation_data = tessellator.tessellate()
    n_tetrahedra = len(tessellation_data['tetrahedra'])
    n_connections = sum(len(v) for v in tessellation_data['connectivity'].values()) // 2
    
    ctx['logger'].info(f'Delaunay tessellation (PBC={pbc_active}): {n_tetrahedra} tetrahedra, {n_connections} tetrahedral connections')
    return tessellation_data

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

def step_graph(ctx, filtered, tessellation):
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
    
    # Enhance connectivity with tessellation data
    tetrahedral_connectivity = tessellation['connectivity']
    enhanced_connectivity = {}
    
    # Convert connectivity to sets if they aren't already
    for atom_id, neighbors in connectivity.items():
        if isinstance(neighbors, list):
            enhanced_connectivity[atom_id] = set(neighbors)
        else:
            enhanced_connectivity[atom_id] = neighbors.copy()
    
    # Add tetrahedral connections that aren't already in the connectivity graph
    for atom_id, tet_neighbors in tetrahedral_connectivity.items():
        if atom_id not in enhanced_connectivity:
            enhanced_connectivity[atom_id] = set()
        for neighbor_id in tet_neighbors:
            if neighbor_id < len(filtered['positions']):  # Only add connections within original atoms
                enhanced_connectivity[atom_id].add(neighbor_id)
                if neighbor_id not in enhanced_connectivity:
                    enhanced_connectivity[neighbor_id] = set()
                enhanced_connectivity[neighbor_id].add(atom_id)
    
    n_edges = sum(len(v) for v in connectivity.values())//2
    n_enhanced_edges = sum(len(v) for v in enhanced_connectivity.values())//2
    
    ctx['logger'].info(f'Graph: {n_edges} original edges, {n_enhanced_edges} with tessellation enhancement')
    return enhanced_connectivity

def step_displacement(ctx, connectivity, filtered):
    data = ctx['data']
    
    box_bounds = np.array(data['box'], dtype=np.float64)
    pbc_active = [True, True, True]
    
    ctx['pbc_active'] = pbc_active
    ctx['logger'].info(f'PBC settings: x={pbc_active[0]}, y={pbc_active[1]}, z={pbc_active[2]}')
    
    connectivity_lists = {}
    for atom_id, neighbors in connectivity.items():
        if isinstance(neighbors, set):
            connectivity_lists[atom_id] = list(neighbors)
        else:
            connectivity_lists[atom_id] = neighbors
    
    analyzer = DisplacementFieldAnalyzer(
        positions=filtered['positions'],
        connectivity=connectivity_lists,
        ptm_types=filtered['ptm_types'],
        quaternions=filtered['quaternions'],
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        box_bounds=data['box']
    )
    disp_vecs, avg_mags = analyzer.compute_displacement_field()
    
    # Apply PBC unwrapping to displacement vectors if PBC is detected
    if any(pbc_active):
        ctx['logger'].info(f'Applying PBC unwrapping for displacement field')
        unwrapped_disp_vecs = {}
        for atom_id, disp_vec in disp_vecs.items():
            if not np.isnan(disp_vec).any():
                unwrapped_disp_vecs[atom_id] = unwrap_pbc_displacement(disp_vec, box_bounds)
            else:
                unwrapped_disp_vecs[atom_id] = disp_vec
        disp_vecs = unwrapped_disp_vecs
    
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

    ctx['loops'] = {'loops': final_loops, 'burgers': final_burgers}
    return ctx['loops']

def step_nye_tensor(ctx, advanced_loops, filtered):
    positions = filtered['positions']
    burgers = advanced_loops['burgers']
    volume = np.prod(filtered.get('box_lengths', [1, 1, 1]))
    tensor = np.zeros((3, 3), dtype=np.float32)
    for i, b in burgers.items():
        loop = advanced_loops['loops'][i]
        if len(loop) < 2:
            continue
        start = positions[loop[0]]
        end = positions[loop[-1]]
        lvec = end - start
        tensor += np.outer(b, lvec)
    if volume > 0:
        tensor /= volume
    ctx['logger'].info(f"Nye tensor computed:\n{tensor}")
    return {'nye_tensor': tensor}

def step_advanced_grouping(ctx, loops, filtered):
    burgers = loops['burgers']
    positions = filtered['positions']
    loop_centers = [positions[loop].mean(axis=0) for loop in loops['loops']]
    B = np.array([burgers[i] for i in range(len(loops['loops']))])
    C = np.array(loop_centers)
    dist_matrix = cdist(C, C)
    angle_matrix = np.array([
        [np.dot(B[i], B[j]) / (np.linalg.norm(B[i]) * np.linalg.norm(B[j]) + 1e-10)
         for j in range(len(B))] for i in range(len(B))
    ])
    threshold_dist = 5.0
    threshold_angle = 0.9
    groups = []
    used = set()
    for i in range(len(B)):
        if i in used:
            continue
        group = [i]
        used.add(i)
        for j in range(i + 1, len(B)):
            if j in used:
                continue
            if dist_matrix[i, j] < threshold_dist and angle_matrix[i, j] > threshold_angle:
                group.append(j)
                used.add(j)
        groups.append(group)
    new_loops = []
    new_burgers = {}
    for gid, group in enumerate(groups):
        merged = sorted(set([idx for i in group for idx in loops['loops'][i]]))
        new_loops.append(merged)
        avg_b = np.mean([burgers[i] for i in group], axis=0)
        new_burgers[gid] = avg_b
    ctx['logger'].info(f'Advanced grouping reduced to {len(new_loops)} lines')
    ctx['advanced_loops'] = {'loops': new_loops, 'burgers': new_burgers}
    return ctx['advanced_loops']

def step_summary_report(ctx, validate):
    loops = ctx['advanced_loops']
    burgers_list = [loops['burgers'][i] for i in validate['valid']]
    magnitudes = [np.linalg.norm(b) for b in burgers_list]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    ctx['logger'].info(f'Report: {len(validate["valid"])} valid dislocation loops')
    ctx['logger'].info(f'Report: Avg Burgers magnitude: {mean_mag:.4f}')
    return {'count': len(validate['valid']), 'avg_burgers': mean_mag}

def step_validate_dislocations(ctx, advanced_loops):
    validated = []
    for i, burger_vector in advanced_loops['burgers'].items():
        if np.linalg.norm(burger_vector) > 1e-5:
            validated.append(i)
    ctx['logger'].info(f'{len(validated)} valid loops detected')
    ctx['validated_loops'] = validated
    return {'valid': validated}

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
    return {'lines': lines, 'types': line_types}

def step_export(ctx, lines, advanced_loops, filtered):
    data = ctx['data']
    args = ctx['args']
    exporter = DislocationExporter(
        positions=filtered['positions'],
        loops=advanced_loops['loops'],
        burgers=advanced_loops['burgers'],
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
    workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
    workflow.register('validate', step_validate_dislocations, depends_on=['advanced_loops'])
    workflow.register('lines', step_dislocation_lines, depends_on=['advanced_loops', 'filtered'])
    workflow.register('nye', step_nye_tensor, depends_on=['advanced_loops', 'filtered'])
    workflow.register('report', step_summary_report, depends_on=['validate'])
    workflow.register('export', step_export, depends_on=['lines', 'advanced_loops', 'filtered'])

    return workflow

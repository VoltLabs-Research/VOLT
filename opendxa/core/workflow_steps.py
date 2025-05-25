from opendxa.filters import FilteredLoopFinder, LoopGrouper, LoopCanonicalizer
from opendxa.export import DislocationExporter
from opendxa.neighbors import HybridNeighborFinder
from opendxa.core.sequentials import Sequentials
from opendxa.core.connectivity_manager import ConnectivityManager
from opendxa.core.unified_burgers_validator import UnifiedBurgersValidator
from scipy.spatial.distance import cdist
from opendxa.filters.burgers_normalizer import BurgersNormalizer, create_burgers_validation_report

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
    base_connectivity = connectivity_graph.build_graph()
    
    # Initialize centralized connectivity manager
    connectivity_manager = ConnectivityManager(base_connectivity)
    
    # Enhance with tessellation data
    enhanced_connectivity = connectivity_manager.enhance_with_tessellation(
        tessellation['connectivity'], 
        len(filtered['positions'])
    )
    
    # Store manager in context for use by other steps
    ctx['connectivity_manager'] = connectivity_manager
    
    n_base_edges = connectivity_manager.get_edge_count(use_enhanced=False)
    n_enhanced_edges = connectivity_manager.get_edge_count(use_enhanced=True)
    
    ctx['logger'].info(f'Connectivity centralized: {n_base_edges} base -> {n_enhanced_edges} enhanced edges')
    return enhanced_connectivity

def estimate_lattice_parameter(ctx, filtered, data, args):
    """Estimate lattice parameter from first neighbor distances"""
    box_bounds = np.array(data['box'], dtype=np.float64)
    pbc_active = getattr(args, 'pbc', [True, True, True])
    if isinstance(pbc_active, bool):
        pbc_active = [pbc_active, pbc_active, pbc_active]

    original_connectivity = {}
    for atom_id, neighbors in filtered['neighbors'].items():
        if isinstance(neighbors, list):
            original_connectivity[atom_id] = neighbors
        else:
            original_connectivity[atom_id] = list(neighbors) if hasattr(neighbors, '__iter__') else []
    
    first_neighbor_distances = []
    for atom_id, neighbors in original_connectivity.items():
        if len(neighbors) > 0:
            pos = filtered['positions'][atom_id]
            neighbor_dists = []
            for neighbor_id in neighbors:
                if neighbor_id < len(filtered['positions']):
                    neighbor_pos = filtered['positions'][neighbor_id]
                    if any(pbc_active):
                        dist, _ = compute_minimum_image_distance(pos, neighbor_pos, box_bounds)
                    else:
                        dist = np.linalg.norm(neighbor_pos - pos)
                    neighbor_dists.append(dist)
            
            if neighbor_dists:
                min_dist = min(neighbor_dists)
                first_neighbor_distances.append(min_dist)
    
    if first_neighbor_distances:
        first_shell_distance = np.median(first_neighbor_distances)  # Usar mediana para robustez
        lattice_parameter = first_shell_distance * np.sqrt(2)
        ctx['logger'].info(f'First neighbor distance: {first_shell_distance:.3f} Å')
        ctx['logger'].info(f'Estimated lattice parameter: {lattice_parameter:.3f} Å')
        ctx['lattice_parameter'] = lattice_parameter
        ctx['crystal_type'] = getattr(args, 'crystal_type', 'fcc')
        
        if lattice_parameter < 2.0 or lattice_parameter > 6.0:
            ctx['logger'].warning(f'Lattice parameter {lattice_parameter:.3f} Å seems unrealistic, using default')
            lattice_parameter = 4.0
            ctx['lattice_parameter'] = lattice_parameter
    else:
        lattice_parameter = 4.0 
        ctx['lattice_parameter'] = lattice_parameter
        ctx['crystal_type'] = getattr(args, 'crystal_type', 'fcc')
        ctx['logger'].warning('Could not estimate lattice parameter, using default 4.0 Å')

def step_displacement(ctx, connectivity, filtered):
    data = ctx['data']
    args = ctx['args']
    
    box_bounds = np.array(data['box'], dtype=np.float64)
    pbc_active = [True, True, True]
    
    ctx['pbc_active'] = pbc_active
    ctx['logger'].info(f'PBC settings: x={pbc_active[0]}, y={pbc_active[1]}, z={pbc_active[2]}')
    
    # Estimate lattice parameter for later use in validation
    estimate_lattice_parameter(ctx, filtered, data, args)
    
    # Use connectivity manager to get lists representation
    connectivity_manager = ctx['connectivity_manager']
    connectivity_lists = connectivity_manager.as_lists(use_enhanced=True)
    
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

def step_refine_lines(ctx, lines, filtered):
    args = ctx['args']
    data = ctx['data']
    
    # Core marking
    core_marker = DislocationCoreMarker(
        core_radius=getattr(args, 'core_radius', 2.0)
    )
    
    dislocation_lines = [line['atoms'] for line in lines]
    burgers_vectors = {i: line['burgers_vector'] for i, line in enumerate(lines)}
    
    core_classification = core_marker.mark_core_atoms(
        dislocation_lines=dislocation_lines,
        positions=filtered['positions'],
        burgers_vectors=burgers_vectors
    )
    
    # Line smoothing
    smoother = DislocationLineSmoother(
        smoothing_level=getattr(args, 'line_smoothing_level', 3),
        point_interval=getattr(args, 'line_point_interval', 1.0)
    )
    
    smoothed_positions = smoother.smooth_lines(
        dislocation_lines=dislocation_lines,
        positions=filtered['positions']
    )
    
    # Combine results
    refined_lines = []
    for i, line in enumerate(lines):
        refined_line = line.copy()
        refined_line['smoothed_positions'] = smoothed_positions[i]
        refined_lines.append(refined_line)
    
    # Calculate comprehensive statistics
    box = np.array(data['box'])
    volume = np.prod(box[:, 1] - box[:, 0])
    
    stats_generator = DislocationStatisticsGenerator()
    statistics = stats_generator.generate_statistics(
        dislocation_lines=refined_lines,
        burgers_vectors=burgers_vectors,
        core_atoms=core_classification,
        system_volume=volume
    )
    
    # Compute Nye tensor (en unidades de Å⁻¹)
    positions = filtered['positions']
    tensor = np.zeros((3, 3), dtype=np.float32)
    for i, b in burgers_vectors.items():
        loop = dislocation_lines[i]
        if len(loop) < 2:
            continue
        start = positions[loop[0]]
        end = positions[loop[-1]]
        lvec = end - start
        # Normalizar por la longitud del segmento para obtener densidad de Burgers
        length = np.linalg.norm(lvec)
        if length > 0:
            direction = lvec / length
            tensor += np.outer(b, direction) * (1.0 / volume)  # Densidad por unidad de volumen
    
    statistics['nye_tensor'] = tensor
    statistics['nye_tensor_units'] = 'Å⁻¹'
    
    # Generate summary report
    magnitudes = [np.linalg.norm(b) for b in burgers_vectors.values()]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    
    if magnitudes:
        min_mag = np.min(magnitudes)
        max_mag = np.max(magnitudes)
        std_mag = np.std(magnitudes)
        ctx['logger'].info(f'Burgers magnitudes: min={min_mag:.3f}, max={max_mag:.3f}, '
                          f'mean={mean_mag:.3f}, std={std_mag:.3f} Å')
    
    statistics['summary'] = {
        'count': len(refined_lines),
        'avg_burgers_magnitude': mean_mag,
        'min_burgers_magnitude': np.min(magnitudes) if magnitudes else 0.0,
        'max_burgers_magnitude': np.max(magnitudes) if magnitudes else 0.0,
        'std_burgers_magnitude': np.std(magnitudes) if magnitudes else 0.0,
        'total_core_atoms': len(core_classification["core_atoms"])
    }
    
    ctx['logger'].info(f'Line refinement: {len(core_classification["core_atoms"])} core atoms, {len(refined_lines)} smoothed lines')
    ctx['logger'].info(f'Statistics: {len(refined_lines)} lines, avg Burgers: {mean_mag:.4f}')
    ctx['logger'].info(f"Nye tensor computed:\n{tensor}")
    
    return {
        'refined_lines': refined_lines,
        'core_atoms': core_classification,
        'statistics': statistics
    }

def step_burgers_loops(ctx, connectivity, filtered):
    data = ctx['data']
    args = ctx['args']
    
    # Use connectivity manager for optimized loop finding
    connectivity_manager = ctx['connectivity_manager']
    max_connections_per_atom = getattr(args, 'max_connections_per_atom', 8)
    
    # Get filtered connectivity directly from manager (eliminates redundant processing)
    filtered_connectivity = connectivity_manager.filter_for_loop_finding(
        filtered['positions'], max_connections_per_atom
    )
    
    # Configure loop finder with higher limits
    max_loop_length = getattr(args, 'max_loop_length', 12)
    max_loops = getattr(args, 'max_loops', 5000)
    timeout_seconds = getattr(args, 'loop_timeout', 600)
    
    loop_finder = FilteredLoopFinder(
        filtered_connectivity, 
        data['positions'], 
        max_length=max_loop_length,
        max_loops=max_loops,
        timeout_seconds=timeout_seconds
    )
    loops = loop_finder.find_minimal_loops()

    canonicalizer = LoopCanonicalizer(filtered['positions'], data['box'])
    canonical_loops = canonicalizer.canonicalize(loops)

    # Use pre-computed connectivity lists from manager (eliminates conversion redundancy)
    connectivity_lists = connectivity_manager.as_lists(use_enhanced=True)
    
    evaluator = BurgersCircuitEvaluator(
        connectivity=connectivity_lists,
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

    ctx['logger'].info(f'Optimized Burgers loops: {len(final_loops)} loops using centralized connectivity')
    ctx['loops'] = {'loops': final_loops, 'burgers': final_burgers}
    return ctx['loops']

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


def step_unified_validation(ctx, advanced_loops, displacement, filtered):
    """Unified validation using both Burgers circuits (primary) and elastic mapping (secondary)"""
    data = ctx['data']
    args = ctx['args']
    
    # Get parameters from context
    lattice_parameter = ctx.get('lattice_parameter', 4.0)
    crystal_type = ctx.get('crystal_type', 'fcc')
    
    # Setup elastic mapping parameters
    box_bounds = np.array(data['box'], dtype=np.float64)
    pbc_active = getattr(args, 'pbc', [True, True, True])
    if isinstance(pbc_active, bool):
        pbc_active = [pbc_active, pbc_active, pbc_active]
    
    # Get connectivity from manager (eliminates redundant processing)
    connectivity_manager = ctx['connectivity_manager']
    connectivity_dict = connectivity_manager.as_lists(use_enhanced=True)
    
    # Initialize unified validator with both methods
    validator = UnifiedBurgersValidator(
        crystal_type=crystal_type,
        lattice_parameter=lattice_parameter,
        tolerance=getattr(args, 'validation_tolerance', 0.15),
        box_bounds=box_bounds,
        pbc=pbc_active
    )
    
    # Perform unified validation combining circuits and elastic mapping
    validation_result = validator.validate_burgers_vectors(
        primary_burgers=advanced_loops['burgers'],
        positions=filtered['positions'],
        connectivity=connectivity_dict,
        displacement_field=displacement['vectors'],
        loops=advanced_loops['loops']
    )
    
    # Extract results from the correct structure
    final_validation = validation_result['final_validation']
    validated_indices = final_validation['valid_loops']
    final_burgers = final_validation.get('normalized_burgers', advanced_loops['burgers'])
    cross_validation_metrics = validation_result['consistency_metrics']
    consistency_score = cross_validation_metrics['overall_consistency']
    
    # Log comprehensive validation results
    total_loops = len(advanced_loops['burgers'])
    ctx['logger'].info(f'Unified validation: {len(validated_indices)}/{total_loops} loops validated')
    ctx['logger'].info(f'Cross-validation consistency: {consistency_score:.3f}')
    ctx['logger'].info(f'Consistent loops: {len(cross_validation_metrics["consistent_loops"])}')
    ctx['logger'].info(f'Mean relative error: {cross_validation_metrics["mean_relative_error"]:.3f}')
    
    # Store validation results in context
    ctx['validated_loops'] = validated_indices
    ctx['final_burgers'] = final_burgers
    ctx['cross_validation_metrics'] = cross_validation_metrics
    
    return {
        'valid': validated_indices,
        'final_burgers': final_burgers,
        'cross_validation_metrics': cross_validation_metrics,
        'consistency_score': consistency_score
    }

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

def create_and_configure_workflow(ctx):
    workflow = Sequentials(ctx)

    workflow.register('neighbors', step_neighbors)
    workflow.register('ptm', step_classify_ptm, depends_on=['neighbors'])
    workflow.register('filtered', step_surface_filter, depends_on=['ptm'])
    workflow.register('tessellation', step_delaunay_tessellation, depends_on=['filtered'])
    workflow.register('connectivity', step_graph, depends_on=['filtered', 'tessellation'])
    workflow.register('displacement', step_displacement, depends_on=['connectivity', 'filtered'])
    
    # Optimized workflow: eliminated redundant elastic_mapping step
    workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
    workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
    
    # Unified validation replaces separate validation and elastic mapping
    workflow.register('validate', step_unified_validation, depends_on=['advanced_loops', 'displacement', 'filtered'])
    workflow.register('lines', step_dislocation_lines, depends_on=['advanced_loops', 'filtered'])
    
    workflow.register('refinement', step_refine_lines, depends_on=['lines', 'filtered'])
    workflow.register('export', step_export, depends_on=['refinement'])

    return workflow

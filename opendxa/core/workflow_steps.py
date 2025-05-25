from opendxa.filters import FilteredLoopFinder, LoopGrouper, LoopCanonicalizer
from opendxa.export import DislocationExporter
from opendxa.neighbors import HybridNeighborFinder
from opendxa.core.sequentials import Sequentials
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

def step_elastic_mapping(ctx, connectivity, displacement, filtered):
    args = ctx['args']
    data = ctx['data']
    
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
        ctx['crystal_type']      = getattr(args, 'crystal_type', 'fcc')
        if lattice_parameter < 2.0 or lattice_parameter > 6.0:
            ctx['logger'].warning(f'Lattice parameter {lattice_parameter:.3f} Å seems unrealistic, using default')
            lattice_parameter = 4.0
    else:
        lattice_parameter = 4.0 
        ctx['logger'].warning('Could not estimate lattice parameter, using default 4.0 Å')
    
    physical_tolerance = 0.10 * lattice_parameter
    
    displacement_magnitudes = [np.linalg.norm(v) for v in displacement['vectors'].values() if not np.isnan(v).any()]
    if displacement_magnitudes:
        displacement_std = np.std(displacement_magnitudes)
        adaptive_tolerance = max(physical_tolerance, min(0.2 * lattice_parameter, displacement_std * 0.3))
        ctx['logger'].info(f'Displacement std: {displacement_std:.3f}, adaptive tolerance: {adaptive_tolerance:.3f}')
    else:
        adaptive_tolerance = physical_tolerance
    
    mapper = ElasticMapper(
        crystal_type=getattr(args, 'crystal_type', 'fcc'),
        lattice_parameter=getattr(args, 'lattice_param', lattice_parameter),
        tolerance=getattr(args, 'elastic_tolerance', adaptive_tolerance),
        box_bounds=box_bounds,
        pbc=pbc_active
    )
    
    ctx['logger'].info(f'Connectivity graph elastic mapping: lattice={mapper.lattice_param:.3f}, tolerance={mapper.tolerance:.3f}')
    
    edge_vectors = mapper.compute_edge_vectors(connectivity, filtered['positions'])
    edge_burgers = mapper.map_edge_burgers(edge_vectors, displacement['vectors'])
    
    ctx['logger'].info(f'Elastic mapping on connectivity graph: {len(edge_burgers)} edges mapped')
    return {'edge_vectors': edge_vectors, 'edge_burgers': edge_burgers}

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
    
    # Análisis físico de magnitudes de Burgers
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
    
    # Convert connectivity sets to lists for components that need them
    connectivity_lists = {}
    for atom_id, neighbors in connectivity.items():
        if isinstance(neighbors, set):
            connectivity_lists[atom_id] = list(neighbors)
        else:
            connectivity_lists[atom_id] = neighbors
    
    # Filter connectivity for loop finding to avoid exponential explosion
    # Only keep the N strongest connections per atom for loop finding
    max_connections_per_atom = getattr(args, 'max_connections_per_atom', 8)
    filtered_connectivity = {}
    
    for atom_id, neighbors in connectivity_lists.items():
        if len(neighbors) <= max_connections_per_atom:
            filtered_connectivity[atom_id] = neighbors
        else:
            # Keep only the closest neighbors for loop finding
            atom_pos = filtered['positions'][atom_id]
            neighbor_distances = []
            for neighbor_id in neighbors:
                neighbor_pos = filtered['positions'][neighbor_id]
                dist = np.linalg.norm(neighbor_pos - atom_pos)
                neighbor_distances.append((dist, neighbor_id))
            
            # Sort by distance and keep the closest ones
            neighbor_distances.sort()
            closest_neighbors = [neighbor_id for _, neighbor_id in neighbor_distances[:max_connections_per_atom]]
            filtered_connectivity[atom_id] = closest_neighbors
    
    # Log the connectivity reduction
    total_original = sum(len(v) for v in connectivity_lists.values()) // 2
    total_filtered = sum(len(v) for v in filtered_connectivity.values()) // 2
    ctx['logger'].info(f'Loop finding connectivity: {total_original} -> {total_filtered} edges (filtered for performance)')
    
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
    # Get crystal parameters from context
    lattice_parameter = ctx.get('lattice_parameter', 1.0)
    crystal_type = ctx.get('crystal_type', 'fcc')
    
    # Initialize Burgers vector normalizer
    normalizer = BurgersNormalizer(
        crystal_type=crystal_type,
        lattice_parameter=lattice_parameter,
        tolerance=0.15
    )
    
    # Normalize and validate Burgers vectors
    validated = []
    normalized_burgers = {}
    validation_stats = {'perfect': 0, 'partial': 0, 'unmapped': 0, 'zero': 0}
    
    for i, burger_vector in advanced_loops['burgers'].items():
        magnitude = np.linalg.norm(burger_vector)
        
        if magnitude > 1e-5:
            # Normalize to crystallographic form
            normalized, b_type, distance = normalizer.normalize_burgers_vector(burger_vector)
            
            # Store normalized vector
            normalized_burgers[i] = normalized
            validation_stats[b_type] += 1
            
            # Validate magnitude is physically reasonable
            validation_metrics = normalizer.validate_burgers_magnitude(burger_vector)
            
            if (validation_metrics['is_realistic_perfect'] or 
                validation_metrics['is_realistic_partial']):
                validated.append(i)
                
                # Log normalized representation
                burgers_string = normalizer.burgers_to_string(normalized)
                ctx['logger'].debug(f"Loop {i}: |b|={magnitude:.3f} Å -> {burgers_string} ({b_type})")
        else:
            validation_stats['zero'] += 1
    
    burgers_report = create_burgers_validation_report(advanced_loops['burgers'], normalizer)
    
    total_loops = len(advanced_loops['burgers'])
    ctx['logger'].info(f'Burgers vector validation: {len(validated)}/{total_loops} valid loops')
    ctx['logger'].info(f'Classification: {validation_stats["perfect"]} perfect, '
                      f'{validation_stats["partial"]} partial, '
                      f'{validation_stats["unmapped"]} unmapped, '
                      f'{validation_stats["zero"]} zero')
    
    if burgers_report['magnitude_stats']:
        ctx['logger'].info(f'Magnitude stats: mean={burgers_report["magnitude_mean"]:.3f} Å, '
                          f'std={burgers_report["magnitude_std"]:.3f} Å')
    
    ctx['validated_loops'] = validated
    ctx['normalized_burgers'] = normalized_burgers
    ctx['burgers_validation_report'] = burgers_report
    ctx['validation_stats'] = validation_stats
    
    return {
        'valid': validated,
        'normalized_burgers': normalized_burgers,
        'validation_report': burgers_report,
        'stats': validation_stats
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
    workflow.register('elastic_mapping', step_elastic_mapping, depends_on=['connectivity', 'displacement', 'filtered'])
    
    workflow.register('loops', step_burgers_loops, depends_on=['connectivity', 'filtered'])
    workflow.register('advanced_loops', step_advanced_grouping, depends_on=['loops', 'filtered'])
    workflow.register('validate', step_validate_dislocations, depends_on=['advanced_loops'])
    workflow.register('lines', step_dislocation_lines, depends_on=['advanced_loops', 'filtered'])
    
    workflow.register('refinement', step_refine_lines, depends_on=['lines', 'filtered'])
    workflow.register('export', step_export, depends_on=['refinement'])

    return workflow

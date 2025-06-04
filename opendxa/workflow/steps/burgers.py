from opendxa.filters import FilteredLoopFinder, LoopCanonicalizer, LoopGrouper
from opendxa.classification import BurgersCircuitEvaluator
from scipy.spatial.distance import cdist
import numpy as np
import time

def step_burgers_loops(ctx, filtered):
    data = ctx['data']
    args = ctx['args']
    
    # Use connectivity manager for optimized loop finding
    connectivity_manager = ctx['connectivity_manager']
    
    # Get filtered connectivity directly from manager (eliminates redundant processing)
    start_time = time.perf_counter()
    filtered_connectivity = connectivity_manager.filter_for_loop_finding(
        filtered['positions'], args.max_connections_per_atom
    )
    ctx['logger'].info(f'Connectivity filtering: {time.perf_counter() - start_time:.3f}s')
    
    start_time = time.perf_counter()
    loop_finder = FilteredLoopFinder(
        filtered_connectivity, 
        # data['positions'],
        filtered['positions'], 
        max_length=args.max_loop_length,
        max_loops=args.max_loops,
        timeout_seconds=args.loop_timeout
    )
    loops = loop_finder.find_minimal_loops()
    ctx['logger'].info(f'Loop finding: {time.perf_counter() - start_time:.3f}s, found {len(loops)} loops')

    start_time = time.perf_counter()
    canonicalizer = LoopCanonicalizer(filtered['positions'], data['box'])
    canonical_loops = canonicalizer.canonicalize(loops)
    ctx['logger'].info(f'Loop canonicalization: {time.perf_counter() - start_time:.3f}s')

    # Use pre-computed connectivity lists from manager (eliminates conversion redundancy)
    connectivity_lists = connectivity_manager.as_lists(use_enhanced=True)
    
    start_time = time.perf_counter()
    evaluator = BurgersCircuitEvaluator(
        connectivity=connectivity_lists,
        positions=filtered['positions'],
        types=filtered['types'],
        quaternions=filtered['quaternions'],
        templates=ctx['templates'],
        template_sizes=ctx['template_sizes'],
        box_bounds=data['box']
    )
    evaluator.loops = canonical_loops
    raw_burgers = evaluator.calculate_burgers()
    ctx['logger'].info(f'Burgers evaluation: {time.perf_counter() - start_time:.3f}s')

    start_time = time.perf_counter()
    grouper = LoopGrouper(raw_burgers, canonical_loops, filtered['positions'])
    groups = grouper.group_loops()
    ctx['logger'].info(f'Loop grouping: {time.perf_counter() - start_time:.3f}s')

    start_time = time.perf_counter()
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
    ctx['logger'].info(f'Final loop processing: {time.perf_counter() - start_time:.3f}s')

    ctx['logger'].info(f'Optimized Burgers loops: {len(final_loops)} loops using centralized connectivity')
    ctx['loops'] = {'loops': final_loops, 'burgers': final_burgers}
    return ctx['loops']

def step_advanced_grouping(ctx, loops, filtered):
    start_time = time.perf_counter()
    
    burgers = loops['burgers']
    positions = filtered['positions']
    
    # Early exit if no loops
    if not loops['loops']:
        ctx['logger'].info('No loops to group, skipping advanced grouping')
        result = {'loops': [], 'burgers': {}}
        ctx['advanced_loops'] = result
        return result
    
    # Optimize for small datasets - skip expensive grouping if few loops
    if len(loops['loops']) < 10:
        ctx['logger'].info(f'Small dataset ({len(loops["loops"])} loops), using simple grouping')
        new_loops = loops['loops']
        new_burgers = burgers
        ctx['advanced_loops'] = {'loops': new_loops, 'burgers': new_burgers}
        return ctx['advanced_loops']
    
    # Vectorized center calculation
    loop_centers = np.array([positions[loop].mean(axis=0) for loop in loops['loops']])
    B = np.array([burgers[i] for i in range(len(loops['loops']))])
    
    # Use scipy.spatial.distance for optimized distance calculation
    dist_matrix = cdist(loop_centers, loop_centers)
    
    # Vectorized angle calculation with better numerical stability
    B_normalized = B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-10)
    angle_matrix = np.dot(B_normalized, B_normalized.T)
    
    # More aggressive thresholds for speed
    threshold_dist = getattr(ctx['args'], 'grouping_distance_threshold', 3.0)
    threshold_angle = getattr(ctx['args'], 'grouping_angle_threshold', 0.95)
    
    ctx['logger'].info(f'Distance calculation: {time.perf_counter() - start_time:.3f}s')
    
    grouping_start = time.perf_counter()
    groups = []
    used = set()
    
    for i in range(len(B)):
        if i in used:
            continue
        group = [i]
        used.add(i)
        
        # Vectorized search for similar loops
        candidates = np.where(
            (dist_matrix[i] < threshold_dist) & 
            (angle_matrix[i] > threshold_angle) & 
            np.array([j not in used for j in range(len(B))])
        )[0]
        
        for j in candidates:
            if j > i and j not in used:
                group.append(j)
                used.add(j)
        groups.append(group)
    
    ctx['logger'].info(f'Grouping logic: {time.perf_counter() - grouping_start:.3f}s')
    
    # Fast merging
    merging_start = time.perf_counter()
    new_loops = []
    new_burgers = {}
    for gid, group in enumerate(groups):
        # Use set operations for faster merging
        merged = set()
        avg_b = np.zeros(3, dtype=np.float32)
        for i in group:
            merged.update(loops['loops'][i])
            avg_b += burgers[i]
        avg_b /= len(group)
        new_loops.append(sorted(merged))
        new_burgers[gid] = avg_b
    
    ctx['logger'].info(f'Merging: {time.perf_counter() - merging_start:.3f}s')
    ctx['logger'].info(f'Advanced grouping reduced to {len(new_loops)} lines')
    ctx['advanced_loops'] = {'loops': new_loops, 'burgers': new_burgers}
    return ctx['advanced_loops']
from opendxa.filters import FilteredLoopFinder, LoopCanonicalizer, LoopGrouper
from opendxa.classification import BurgersCircuitEvaluator
from scipy.spatial.distance import cdist
import numpy as np

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
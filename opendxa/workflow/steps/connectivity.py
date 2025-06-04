from opendxa.classification import LatticeConnectivityGraph
from opendxa.core.connectivity_manager import ConnectivityManager
from opendxa.utils.pbc import compute_minimum_image_distance
import numpy as np

def step_graph(ctx, filtered, tessellation):
    args = ctx['args']
    connectivity_graph = LatticeConnectivityGraph(
        positions=filtered['positions'],
        ids=filtered['ids'],
        neighbors=filtered['neighbors'],
        types=filtered['types'],
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
        first_shell_distance = np.median(first_neighbor_distances)
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
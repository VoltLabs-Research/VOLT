from opendxa.classification import SurfaceFilter, DelaunayTessellator
import numpy as np

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
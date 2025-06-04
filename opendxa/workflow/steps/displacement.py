from opendxa.workflow.steps.connectivity import estimate_lattice_parameter
from opendxa.classification import DisplacementFieldAnalyzer
from opendxa.utils.pbc import unwrap_pbc_displacement
import numpy as np

def step_displacement(ctx, filtered):
    data = ctx['data']
    args = ctx['args']
    
    box_bounds = np.array(data['box'], dtype=np.float64)
    # TODO: DUPLICATED PBC FORCE ASSIGNMENT
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
        types=filtered['types'],
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
from opendxa.classification.dislocation_core_marker import DislocationCoreMarker
from typing import Dict, Set, List
import numpy as np
import logging

logger = logging.getLogger(__name__)

def step_mark_core_atoms(ctx, refinement, interface_mesh):
    '''
    Mark atoms belonging to dislocation cores by assigning dislocation IDs,
    similar to OVITO's assignCoreAtomDislocationIDs functionality.
    '''
    data = ctx['data']
    positions = data['positions']
    args = ctx['args']
    
    # Get refined dislocation lines
    refined_lines = refinement.get('refined_lines', [])
    
    # Get tessellation data from context
    tessellation = ctx.get('tessellation_result', {})
    tetrahedra = tessellation.get('tetrahedra', [])
    
    # Get interface mesh data
    interface_vertices = interface_mesh.get('vertices', np.array([]))
    interface_faces = interface_mesh.get('faces', np.array([]))
    tetrahedra_classification = interface_mesh.get('tetrahedra_classification', {})
    
    logger.info("Marking dislocation core atoms...")
    logger.info(f"Using interface mesh with {len(interface_vertices)} vertices and {len(interface_faces)} faces")
    
    # Create core atom marker
    core_marker = DislocationCoreMarker(
        positions=positions,
        tetrahedra=tetrahedra,
        dislocation_lines=refined_lines,
        interface_mesh={
            'vertices': interface_vertices,
            'faces': interface_faces,
            'tetrahedra_classification': tetrahedra_classification
        },
        core_radius=args.core_radius
    )
    
    # Mark core atoms
    dislocation_ids = core_marker.assign_core_atom_ids()
    
    # Store for statistics computation
    core_marker._dislocation_ids = dislocation_ids
    
    logger.info(f"Marked {sum(1 for d_id in dislocation_ids.values() if d_id >= 0)} "
                f"atoms as dislocation core atoms")
    
    # Store in context for export
    ctx['dislocation_ids'] = dislocation_ids
    
    return {
        'dislocation_ids': dislocation_ids,
        'core_statistics': core_marker.get_core_statistics()
    }
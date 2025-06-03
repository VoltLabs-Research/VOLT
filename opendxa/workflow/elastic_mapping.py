from opendxa.classification.elastic_mapper import EnhancedElasticMapper, InterfaceMeshBuilder
import logging

logger = logging.getLogger(__name__)

def step_elastic_mapping(ctx, cluster, tessellation):
    """
    Enhanced elastic mapping step that uses cluster information to assign ideal vectors
    to tessellation edges, similar to OVITO's ElasticMapping functionality.
    """
    data = ctx['data']
    positions = data['positions']
    args = ctx['args']
    clusters = cluster['clusters']
    cluster_transitions = cluster['cluster_transitions']
    
    logger.info("Computing enhanced elastic mapping with cluster information...")
    
    # Get tessellation data
    tetrahedra = tessellation['tetrahedra']
    
    # Generate edges from connectivity if edges not provided
    edges = tessellation.get('edges', [])
    if not edges:
        connectivity = tessellation.get('connectivity', {})
        edges = []
        seen_edges = set()
        for atom1, neighbors in connectivity.items():
            for atom2 in neighbors:
                edge = tuple(sorted([atom1, atom2]))
                if edge not in seen_edges:
                    edges.append(edge)
                    seen_edges.add(edge)
        logger.info(f"Generated {len(edges)} edges from connectivity data")
    
    # Create enhanced elastic mapper
    elastic_mapper = EnhancedElasticMapper(
        positions=positions,
        clusters=clusters,
        cluster_transitions=cluster_transitions,
        crystal_type=args.crystal_type,
        lattice_parameter=args.lattice_parameter,
        box_bounds=data['box']
    )
    
    # Compute ideal vectors for tessellation edges
    ideal_edge_vectors = elastic_mapper.compute_ideal_edge_vectors(edges, tetrahedra)
    
    # Store in context for interface mesh generation
    ctx['ideal_edge_vectors'] = ideal_edge_vectors
    
    logger.info(f"Computed ideal vectors for {len(ideal_edge_vectors)} edges")
    
    return {
        'ideal_edge_vectors': ideal_edge_vectors,
        'elastic_mapping_stats': elastic_mapper.get_mapping_statistics()
    }

def step_interface_mesh(ctx, elastic_map):
    """
    Generate interface mesh by identifying good/bad tetrahedra and creating
    triangulated surfaces that separate defective regions.
    """
    data = ctx['data']
    args = ctx['args']
    positions = data['positions']
    ideal_edge_vectors = elastic_map['ideal_edge_vectors']
    
    # Get tessellation data from context
    tessellation = ctx.get('tessellation_result', {})
    tetrahedra = tessellation.get('tetrahedra', [])
    
    logger.info("Generating interface mesh...")
    
    # Create interface mesh builder
    mesh_builder = InterfaceMeshBuilder(
        positions=positions,
        tetrahedra=tetrahedra,
        ideal_edge_vectors=ideal_edge_vectors,
        defect_threshold=args.defect_threshold
    )
    
    # Generate the interface mesh
    interface_mesh = mesh_builder.build_interface_mesh()
    
    # Apply smoothing if requested
    smooth_mesh = args.smooth_mesh
    faces = interface_mesh.get('faces', [])
    
    # Check if faces array is not empty (handle NumPy arrays properly)
    faces_not_empty = len(faces) > 0 if hasattr(faces, '__len__') else faces.size > 0
    if smooth_mesh and faces_not_empty:
        interface_mesh = mesh_builder.smooth_mesh(interface_mesh)
    
    logger.info(f"Generated interface mesh with {len(interface_mesh['vertices'])} vertices "
                f"and {len(interface_mesh['faces'])} faces")
    
    return interface_mesh
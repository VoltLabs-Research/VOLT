from opendxa.core.unified_burgers_validator import UnifiedBurgersValidator
import numpy as np

def step_unified_validation(ctx, advanced_loops, displacement, filtered, structure_classification=None, elastic_map=None, interface_mesh=None):
    """Enhanced unified validation using Burgers circuits, elastic mapping, and interface mesh"""
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
    
    # Get structure types for analysis (from either PTM or CNA)
    structure_types = None
    if structure_classification is not None and isinstance(structure_classification, dict):
        structure_types = structure_classification.get('types', None)
        classification_method = structure_classification.get('classification_method', 'unknown')
        if structure_types is not None:
            ctx['logger'].info(f'Structure-aware validation enabled with {len(structure_types)} atom classifications ({classification_method})')
        else:
            ctx['logger'].debug('Structure classification data available but no types found')
    else:
        ctx['logger'].info('Using default structure assumption for validation')
    
    # Initialize unified validator with enhanced capabilities
    validator = UnifiedBurgersValidator(
        crystal_type=crystal_type,
        lattice_parameter=lattice_parameter,
        tolerance=getattr(args, 'validation_tolerance', 0.15),
        box_bounds=box_bounds,
        pbc=pbc_active,
        allow_non_standard=getattr(args, 'allow_non_standard_burgers', True)
    )
    
    # Prepare enhanced validation data
    enhanced_validation_data = {
        'primary_burgers': advanced_loops['burgers'],
        'positions': filtered['positions'],
        'connectivity': connectivity_dict,
        'displacement_field': displacement['vectors'],
        'loops': advanced_loops['loops'],
        'ptm_types': structure_types  # Maintain compatibility with existing name
    }
    
    # Add elastic mapping data if available
    if elastic_map is not None:
        enhanced_validation_data['ideal_edge_vectors'] = elastic_map.get('ideal_edge_vectors', {})
        enhanced_validation_data['elastic_mapping_stats'] = elastic_map.get('elastic_mapping_stats', {})
        ctx['logger'].info('Using enhanced elastic mapping for validation')
    
    # Add interface mesh data if available
    if interface_mesh is not None:
        enhanced_validation_data['interface_mesh'] = interface_mesh
        enhanced_validation_data['defect_regions'] = interface_mesh.get('tetrahedra_classification', {})
        ctx['logger'].info(f'Using interface mesh with {len(interface_mesh.get("faces", []))} faces')
    
    # Perform enhanced unified validation
    validation_result = validator.validate_burgers_vectors(**enhanced_validation_data)
    
    # Extract results from the correct structure
    final_validation = validation_result['final_validation']
    validated_indices = final_validation['valid_loops']
    final_burgers = final_validation.get('normalized_burgers', advanced_loops['burgers'])
    cross_validation_metrics = validation_result['consistency_metrics']
    consistency_score = cross_validation_metrics['overall_consistency']
    
    # Enhanced metrics if using new data
    enhancement_metrics = {}
    if elastic_map is not None or interface_mesh is not None:
        enhancement_metrics = validation_result.get('enhancement_metrics', {})
    
    # Log comprehensive validation results
    total_loops = len(advanced_loops['burgers'])
    ctx['logger'].info(f'Enhanced unified validation: {len(validated_indices)}/{total_loops} loops validated')
    ctx['logger'].info(f'Cross-validation consistency: {consistency_score:.3f}')
    ctx['logger'].info(f'Consistent loops: {len(cross_validation_metrics["consistent_loops"])}')
    ctx['logger'].info(f'Mean relative error: {cross_validation_metrics["mean_relative_error"]:.3f}')
    
    if enhancement_metrics:
        ctx['logger'].info(f'Enhancement score: {enhancement_metrics.get("enhancement_score", 0.0):.3f}')
        ctx['logger'].info(f'Interface correlation: {enhancement_metrics.get("interface_correlation", 0.0):.3f}')
    
    # Store enhanced validation results in context
    ctx['validated_loops'] = validated_indices
    ctx['final_burgers'] = final_burgers
    ctx['cross_validation_metrics'] = cross_validation_metrics
    ctx['enhancement_metrics'] = enhancement_metrics
    
    return {
        'valid': validated_indices,
        'validated_loops': validated_indices,  # For compatibility
        'burgers_vectors': {i: final_burgers[i] for i in validated_indices},  # For stats reporting
        'final_burgers': final_burgers,
        'cross_validation_metrics': cross_validation_metrics,
        'enhancement_metrics': enhancement_metrics,
        'consistency_score': consistency_score
    }

def step_summary_report(ctx, validate):
    loops = ctx['advanced_loops']
    burgers_list = [loops['burgers'][i] for i in validate['valid']]
    magnitudes = [np.linalg.norm(b) for b in burgers_list]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    ctx['logger'].info(f'Report: {len(validate["valid"])} valid dislocation loops')
    ctx['logger'].info(f'Report: Avg Burgers magnitude: {mean_mag:.4f}')
    return {'count': len(validate['valid']), 'avg_burgers': mean_mag}
from opendxa.core.unified_burgers_validator import UnifiedBurgersValidator
import numpy as np

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

def step_summary_report(ctx, validate):
    loops = ctx['advanced_loops']
    burgers_list = [loops['burgers'][i] for i in validate['valid']]
    magnitudes = [np.linalg.norm(b) for b in burgers_list]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    ctx['logger'].info(f'Report: {len(validate["valid"])} valid dislocation loops')
    ctx['logger'].info(f'Report: Avg Burgers magnitude: {mean_mag:.4f}')
    return {'count': len(validate['valid']), 'avg_burgers': mean_mag}
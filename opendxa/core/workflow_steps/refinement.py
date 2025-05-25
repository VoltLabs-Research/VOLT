from opendxa.classification import DislocationCoreMarker, DislocationLineSmoother, DislocationStatisticsGenerator
import numpy as np

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
        length = np.linalg.norm(lvec)
        if length > 0:
            direction = lvec / length
            tensor += np.outer(b, direction) * (1.0 / volume)
    
    statistics['nye_tensor'] = tensor
    statistics['nye_tensor_units'] = 'Å⁻¹'
    
    # Generate summary report
    magnitudes = [np.linalg.norm(b) for b in burgers_vectors.values()]
    mean_mag = np.mean(magnitudes) if magnitudes else 0.0
    
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
from collections import defaultdict
import numpy as np
import math

burgers_types = {
    '1/2<111>': {
        "vectors": [
            [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5],
            [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5],
            [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5]
        ],
        "magnitude_factor": math.sqrt(3)/2,
        "color": "#4472C4"
    },

    "1/2<110>": {
        "vectors": [
            [0.5, 0.5, 0.0], [0.5, -0.5, 0.0], [-0.5, 0.5, 0.0], [-0.5, -0.5, 0.0],
            [0.5, 0.0, 0.5], [0.5, 0.0, -0.5], [-0.5, 0.0, 0.5], [-0.5, 0.0, -0.5],
            [0.0, 0.5, 0.5], [0.0, 0.5, -0.5], [0.0, -0.5, 0.5], [0.0, -0.5, -0.5]
        ],
        "magnitude_factor": math.sqrt(2)/2,
        "color": "#E7E6E6"
    },

    "<100>": {
        "vectors": [
            [1.0, 0.0, 0.0], [-1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0], [0.0, -1.0, 0.0],
            [0.0, 0.0, 1.0], [0.0, 0.0, -1.0]
        ],
        "magnitude_factor": 1.0,
        "color": "#C55A5A" 
    },

    "<110>": {
        "vectors": [
                [1.0, 1.0, 0.0], [1.0, -1.0, 0.0], [-1.0, 1.0, 0.0], [-1.0, -1.0, 0.0],
                [1.0, 0.0, 1.0], [1.0, 0.0, -1.0], [-1.0, 0.0, 1.0], [-1.0, 0.0, -1.0],
                [0.0, 1.0, 1.0], [0.0, 1.0, -1.0], [0.0, -1.0, 1.0], [0.0, -1.0, -1.0]
        ],
        "magnitude_factor": math.sqrt(2),
        "color": "#4472C4" 
    },

    # Shockley partials
    "1/6<112>": { 
        "vectors": [
            [1/6, 1/6, 2/6], [1/6, 1/6, -2/6], [1/6, -1/6, 2/6], [1/6, -1/6, -2/6],
            [-1/6, 1/6, 2/6], [-1/6, 1/6, -2/6], [-1/6, -1/6, 2/6], [-1/6, -1/6, -2/6],
            [1/6, 2/6, 1/6], [1/6, 2/6, -1/6], [1/6, -2/6, 1/6], [1/6, -2/6, -1/6],
            [-1/6, 2/6, 1/6], [-1/6, 2/6, -1/6], [-1/6, -2/6, 1/6], [-1/6, -2/6, -1/6],
            [2/6, 1/6, 1/6], [2/6, 1/6, -1/6], [2/6, -1/6, 1/6], [2/6, -1/6, -1/6],
            [-2/6, 1/6, 1/6], [-2/6, 1/6, -1/6], [-2/6, -1/6, 1/6], [-2/6, -1/6, -1/6]
        ],
        "magnitude_factor": math.sqrt(6)/6,
        "color": "#70AD47"
    },

    # Frank partials
    "1/3<111>": {
        "vectors": [
            [1/3, 1/3, 1/3], [1/3, 1/3, -1/3], [1/3, -1/3, 1/3], [1/3, -1/3, -1/3],
            [-1/3, 1/3, 1/3], [-1/3, 1/3, -1/3], [-1/3, -1/3, 1/3], [-1/3, -1/3, -1/3]
        ],
        "magnitude_factor": math.sqrt(3)/3,
        "color": "#FFC000" 
    }
}

# lattice parameter
a = 1.0

tolerance = 0.1

def normalize_vector(vector) -> np.ndarray:
    vec = np.array(vector)
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 1e-10 else vec

def vectors_are_parallel(v1, v2, tolerance = 0.1) -> bool:
    v1_norm = normalize_vector(v1)
    v2_norm = normalize_vector(v2)
    
    dot_product = abs(np.dot(v1_norm, v2_norm))
    return dot_product > (1.0 - tolerance)

def classify_burgers_vector(burgers) -> str:
    burgers_vec = np.array(burgers)
    magnitude = np.linalg.norm(burgers_vec)
    
    if magnitude < 1e-10:
        return "Other"

    for burgers_type, type_info in burgers_types.items():
        expected_magnitude = type_info["magnitude_factor"] * a
        
        if abs(magnitude - expected_magnitude) / expected_magnitude < tolerance:
            
            for ref_vector in type_info["vectors"]:
                ref_vec = np.array(ref_vector) * a
                
                if vectors_are_parallel(burgers_vec, ref_vec, tolerance):
                    return burgers_type
    
    return "Other"

def analyze_dislocation_data(json_data: dict):
    analysis_results = defaultdict(lambda: {"count": 0, "total_length": 0.0, "segments": []})
    
    if 'dislocations' not in json_data or 'data' not in json_data['dislocations']:
        return dict(analysis_results)
    
    dislocation_data = json_data['dislocations']['data']
    
    for segment in dislocation_data:
        if 'burgers' in segment and 'vector' in segment['burgers']:
            burgers_vector = segment['burgers']['vector']
            length = segment.get('length', 0.0)
            
            burgers_type = classify_burgers_vector(burgers_vector)
            
            analysis_results[burgers_type]["count"] += 1
            analysis_results[burgers_type]["total_length"] += length
            analysis_results[burgers_type]["segments"].append({
                "index": segment.get("index", -1),
                "burgers_vector": burgers_vector,
                "magnitude": segment['burgers'].get('magnitude', 0.0),
                "length": length
            })
    
    sorted_results = sorted(analysis_results.items(), key=lambda x: x[1]['count'], reverse=True)
    
    total_segments = sum(stats["count"] for _, stats in analysis_results.items() if stats["count"] > 0)
    total_length = sum(stats["total_length"] for _, stats in analysis_results.items() if stats["count"] > 0)
    
    print(f"{'Dislocation type':<20} {'Segs':<8} {'Length':<12} {'% Count':<10} {'% Length':<10}")
    print("-" * 62)

    for burgers_type, stats in sorted_results:
        if stats["count"] > 0:
            count_percentage = (stats["count"] / total_segments * 100) if total_segments > 0 else 0
            length_percentage = (stats["total_length"] / total_length * 100) if total_length > 0 else 0
            
            print(f"{burgers_type:<20} {stats['count']:<8} {stats['total_length']:<12.2f} "
                  f"{count_percentage:<9.1f} {length_percentage:<9.1f}")

    print("-" * 62)
    print(f"{'TOTAL':<20} {total_segments:<8} {total_length:<12.2f} {'100.0%':<9} {'100.0%':<9}")
    
    print('')
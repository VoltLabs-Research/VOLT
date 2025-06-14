from opendxa import DislocationAnalysis, Logger

logger = Logger()
logger.set_level('ERROR')

pipeline = DislocationAnalysis()
analysis = pipeline.compute('/home/rodyherrera/Desktop/Sigma3_yz/dump.ensayo.2900000.config', 'dislocations.vtk')

'''
{
    "dislocations": {
        "num_segments": int,
        "segments": [{
            "index": int,
            "point_index_offset": int,
            "num_points": int,
            "points": [ [X, Y, Z] ] (int, int, int),
            "length": int (segment length),
            "burgers_vector": [X, Y, Z] (int, int, int),
            "burgers_vector_magnitude": int,
            "fractional_burgers": str,
            "burgers_circuit": [{
                "type": forward | backward,
                "num_edges": int,
                "points": [{
                    "index": int,
                    "position": [X, Y, Z] (int, int, int),
                    Edge Node1 Pos X, ...
                    "original_position": [X, Y, Z] (int, int, int),
                    "lattice_vector": [Edge Lattice Vector 0, ...] 
                }] ,
                "edges": [{
                    [i, (i + 1) % edgeCount]
                    "vertices": [int, int]
                    "index": int
                }],
                "cell": {
                    "lattice_vectors": [...]
                },
                "circuit": {
                    Total burgers stats
                    "burgers_vector": [X, Y, Z] (int, int, int),
                    "burgers_magnitude": [X, Y, Z] (int, int, int)
                }
            }]
        }]
    },
    "stacking_faults": [
        "num_stacking_faults": int,
        "data": {
            "index": int,
            "normal_vector": [X, Y, Z],
            "center": [X, Y, Z],
            "base_point": [X, Y, Z],
            "num_hcp_atoms": int,
            "num_isf_atoms": int,
            "num_tb_atoms": int,
            "is_infinite": [bool, bool, boll],
            "is_invalid": bool,
            "num_contours": int,
            "total_edges": int,
            "total_points": int,
            "contours": [{
                "contour_id": int,
                "num_edges": int,
                "num_points": int,
                "total_edges": int,
                "points": [{
                    "index": int,
                    "position": [x, Y, Z] (int, int, int)
                    "tag": int
                }],
                "edges": [{
                    "vertices": [int, int],
                    "edge_index": int
                }],
                "cell": {
                    "edge_index": [...],
                    "facet_determinant": [...],
                    "node_index": [...],
                    "is_sf_edge": [...]
                },
                "contour": {
                    "stacking_fault_edge_count": int,
                    "stacking_fault_ratio": int,
                    "facet_determinant_range": {
                        "max": int,
                        "min": int,
                        "mean": int
                    }
                }
            }],
            "consolidated": {
                "points": [{
                    "index": int,
                    "contour_id": int,
                    "position": [X, Y, Z] (int, int, int),
                    "tag": int
                }],
                "edges": [{
                    "vertices": [int, int],
                    "contour_id": int
                }],
                "cell": {
                    "contour_id": [int],
                    "edge_index_local": [int],
                    "edge_index_global": [int]
                }
            },
            "summary": {
                "total_contours": int,
                "total_edges": int,
                "total_points": int,
                "total_stacking_fault_edges": int,
                "overall_stacking_fault_ratio": float,
                "global_facet_determinant_range": {
                    "min": float,
                    "max": float,
                    "mean": float
                }
            }
        }
    }],
    "interface_mesh": {
        "metadata": {
            "num_nodes": int
            "num_facets": int,
            "num_edges": int,
            "total_cells": int (numEdges + numFacets),
        },
        "points": [{
            "index": int,
            "position": [X, Y, Z] (int, int, int),
        }],
        "edges": [{
            "vertices": [index, edge neighbor index] (int int),
            "edge_count": int,
            "isSF": 1 | 0
        }],
        "facets": [{
            "vertices": [index vertex 1, index vertex 2, index vertex 3] (int int int),
            "segment": index (int) | -1,
            "final_segment": index | -1
            "is_primary_segment": 1 | 0,
            "selection": int,
        }],
        "summary": {
            "edge_count": [int],
            "segment": [int],
            "final_segment": [int],
            "is_primary_segment": [int],
            "selection": [int],
            "isSF": [int]
        }
    },
    "atoms": {
        "metadata": {
            "num_atoms": int
        },
        "data": [{
            "index": int,
            "position": [X, Y, Z] (int, int, int),
            "cna": {
                "atom_type": 0 | 1 | 2 | 3 | 4 | 5,
                "coordination": int,
                "recursive_depth": int
            }
        }]
    },
    "output_mesh": {
        "metadata": {
            "num_vertices": int,
            "num_facets": int,
            "total_cells": int
        },
        "vertices": [{
            "index": int,
            "position": [X, Y, Z] (int, int, int)
            "normal": [X, Y, Z] (int, int, int),
        }]
    }
}
'''
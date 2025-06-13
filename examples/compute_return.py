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
            "id": int,
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
    "interface_mesh": {
        "metadata": {
            "num_nodes": int
            "num_facets": int,
            "num_edges": int,
            "total_cells": int (numEdges + numFacets),
        },
        "points": [{
            "index": int,
            "coordinates": [X, Y, Z] (int, int, int),
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
            "id": int,
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
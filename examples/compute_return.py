from opendxa import DislocationAnalysis, Logger

logger = Logger()
logger.set_level('ERROR')

pipeline = DislocationAnalysis()
analysis = pipeline.compute('/home/rodyherrera/Desktop/Sigma3_yz/dump.ensayo.2900000.config', 'dislocations.vtk')

'''
{
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
print(analysis['output_mesh'])
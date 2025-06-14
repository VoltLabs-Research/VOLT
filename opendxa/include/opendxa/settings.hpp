#ifndef OPENDXA_SETTINGS_HPP
#define OPENDXA_SETTINGS_HPP

// The maximum number of edges a mesh node may have.
// Originally, the maximum number of edges was 22. This works on small systems, 
// but not on larger ones (tested with 6 million atoms). One use of this constant is 
// in /opendxa/core/interface_mesh.cpp in the duplicateSharedMeshNodes() function. On 
// larger systems, the memory allocation for the "edgeVisited" array was exceeded. 
// I'm not sure if increasing the value is a long-term solution; perhaps it could be dynamically sized.
// 
// Well, if you go back to 22, you'll get a dumped segmentation fault core when 
// loading large simulations. Here's part of the output while I was debugging the problem.
// opendxa/src/core/interface_mesh.cpp:715:46: 
// runtime error: store to address 0x155551f56a76 with insufficient
// space for an object of type 'bool'.
#define MAX_NODE_EDGES 32

// The maximum number of nearest-neighbors a crystalline atom may have.
#define MAX_CRYSTALLINE_ATOM_NEIGHBORS 14

// The maximum number of nearest-neighbors a regular atom (crystalline and non-crystalline) may have.
#define MAX_ATOM_NEIGHBORS 20

// This is used to avoid disclinations.
#define NUM_RECURSIVE_WALK_PRIORITIES 5

// This setting is used by the recursive function
// createMeshNodeRecursive() as a stopping criterion.
// TODO: check this for BCC
#define MAX_RECURSIVE_ATOM_REPLACEMENT_DEPTH 4

// This setting is for closeFacetHoles().
#define MAX_FACET_HOLE_EDGE_COUNT 12

// The maximum number of edges in a Burgers circuit used during 
// search of primary dislocation segments.
#define DEFAULT_MAX_BURGERS_CIRCUIT_SIZE 3

// The maximum number of edges in a Burgers circuit when the primary 
// dislocation segments are being extended towards the nodal points.
#define DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE 16

// The default number of iterations performed for the mesh smoothing algorithm.
#define DEFAULT_SURFACE_SMOOTHING_LEVEL	8

// The default number of iterations performed for the dislocation line smoothing algorithm.
#define DEFAULT_LINE_SMOOTHING_LEVEL 4

// The default level coarsening that is performed prior to smoothing.
#define DEFAULT_LINE_COARSENING_LEVEL 4

// The default flattening level for triangulated stacking fault planes.
#define DEFAULT_SF_FLATTEN_LEVEL 0.2

#endif
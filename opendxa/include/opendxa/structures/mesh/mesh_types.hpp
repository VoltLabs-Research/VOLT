#ifndef OPENDXA_STRUCTURES_MESH_TYPES_HPP
#define OPENDXA_STRUCTURES_MESH_TYPES_HPP

struct MeshEdge;
struct MeshNode;
struct MeshFacet;
struct BurgersCircuit;
struct OutputEdge;
struct OutputVertex;
struct BaseAtom;

enum FacetBitFlags {
    FACET_IS_PRIMARY_SEGMENT = 0,
    FACET_IS_UNNECESSARY = 1,
};

#endif
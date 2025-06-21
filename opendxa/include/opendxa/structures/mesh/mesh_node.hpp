#ifndef OPENDXA_STRUCTURES_MESH_NODE_HPP
#define OPENDXA_STRUCTURES_MESH_NODE_HPP

#include <opendxa/structures/mesh/mesh_types.hpp>
#include <opendxa/structures/mesh/mesh_edge.hpp>
#include <opendxa/structures/atoms/base_atom.hpp>
#include <opendxa/utils/linalg/lattice_vector.hpp>
#include <opendxa/settings.hpp>

struct MeshNode : public BaseAtom {
    int index;
    int numEdges;
    MeshEdge edges[MAX_NODE_EDGES];
    Vector3 latticeCoord;
    int recursiveDepth;
    MeshEdge* predecessorEdge;
    OutputVertex* outputVertex;

    MeshNode();
    explicit MeshNode(const BaseAtom& other);

    MeshNode* edgeNeighbor(int edgeIndex) const {
        DISLOCATIONS_ASSERT_GLOBAL(edgeIndex >= 0 && edgeIndex < numEdges);
        return edges[edgeIndex].node2();
    }

    int edgeIndex(MeshEdge* edge) const {
        DISLOCATIONS_ASSERT(edge - edges >= 0 && edge - edges < numEdges);
        return edge - edges;
    }

    MeshEdge* createEdge(MeshNode* other, const Vector3& edgeVector);
    void moveEdge(int oldIndex, int newIndex);
    
    MeshEdge* findEdgeTo(MeshNode* node) const;
    MeshEdge* findEdgeToTag(int tag) const;
    MeshEdge* findEdgeWithFacetTo(MeshNode* node) const;
    MeshEdge* findEdgeWithoutFacetTo(MeshNode* node) const;
    MeshEdge* findEdgeWithFacetToTag(int tag) const;
    MeshEdge* findEdgeWithoutFacetToTag(int tag) const;
    
    bool isValid() const;
    void validate() const;
};

#endif
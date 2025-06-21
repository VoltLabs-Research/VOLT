#ifndef OPENDXA_STRUCTURES_MESH_EDGE_HPP
#define OPENDXA_STRUCTURES_MESH_EDGE_HPP

#include <iosfwd>
#include <opendxa/structures/mesh/mesh_types.hpp>
#include <opendxa/utils/linalg/lattice_vector.hpp>

struct MeshEdge {
    MeshNode* node1;
    Vector3 latticeVector;
    MeshFacet* facet;
    MeshEdge* oppositeEdge;
    BurgersCircuit* circuit;
    MeshEdge* nextEdge;
    OutputEdge* outputEdge;
    bool isSFEdge;

    // Constructor
    MeshEdge();

    MeshNode* node2() const { 
        return oppositeEdge->node1; 
    }

    bool isValid() const;
    void setFacet(MeshFacet* newFacet);
    void setCircuit(BurgersCircuit* newCircuit);
};

#endif
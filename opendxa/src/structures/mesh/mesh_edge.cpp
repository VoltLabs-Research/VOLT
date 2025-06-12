#include <opendxa/structures/mesh/mesh_edge.hpp>
#include <opendxa/structures/mesh/mesh_node.hpp>
#include <opendxa/structures/mesh/mesh_facet.hpp>
#include <opendxa/structures/dislocations/burgers_circuit.hpp>
#include <iostream>

MeshEdge::MeshEdge() 
    : node1(nullptr)
    , facet(nullptr)
    , oppositeEdge(nullptr)
    , circuit(nullptr)
    , nextEdge(nullptr)
    , outputEdge(nullptr)
    , isSFEdge(false) {
}

bool MeshEdge::isValid() const{
    return node1 != nullptr && 
           oppositeEdge != nullptr && 
           oppositeEdge->oppositeEdge == this;
}

void MeshEdge::setFacet(MeshFacet* newFacet){
    facet = newFacet;
}

void MeshEdge::setCircuit(BurgersCircuit* newCircuit){
    circuit = newCircuit;
}
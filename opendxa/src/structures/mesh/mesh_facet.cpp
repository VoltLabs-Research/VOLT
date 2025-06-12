#include <opendxa/structures/mesh/mesh_facet.hpp>
#include <opendxa/structures/mesh/mesh_node.hpp>

MeshFacet::MeshFacet() 
    : circuit(nullptr)
    , flags(0)
    , selection(0) {
    edges[0] = edges[1] = edges[2] = nullptr;
}

bool MeshFacet::hasVertex(MeshNode* v) const{
    return edges[0]->node1 == v || 
           edges[1]->node1 == v || 
           edges[2]->node1 == v;
}

int MeshFacet::edgeIndex(MeshEdge* e) const{
    for(int v = 0; v < 3; v++){
        if(edges[v] == e){
            return v;
        }
    }
    DISLOCATIONS_ASSERT_GLOBAL(false);
    return -1;
}

MeshEdge* MeshFacet::nextEdge(MeshEdge* e) const{
    if(edges[0] == e) return edges[1];
    if(edges[1] == e) return edges[2];
    if(edges[2] == e) return edges[0];
    DISLOCATIONS_ASSERT_GLOBAL(false);
    return nullptr;
}

MeshEdge* MeshFacet::previousEdge(MeshEdge* e) const{
    if(edges[0] == e) return edges[2];
    if(edges[1] == e) return edges[0];
    if(edges[2] == e) return edges[1];
    DISLOCATIONS_ASSERT_GLOBAL(false);
    return nullptr;
}

bool MeshFacet::isValid() const{
    for(int i = 0; i < 3; i++){
        if(!edges[i] || !edges[i]->isValid()){
            return false;
        }
    }
    
    return edges[0]->node2() == edges[1]->node1 &&
           edges[1]->node2() == edges[2]->node1 &&
           edges[2]->node2() == edges[0]->node1;
}

void MeshFacet::validate() const{
    DISLOCATIONS_ASSERT_GLOBAL(isValid());
}
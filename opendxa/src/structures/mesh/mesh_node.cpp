#include <opendxa/structures/mesh/mesh_node.hpp>
#include <opendxa/structures/mesh/mesh_facet.hpp>

MeshNode::MeshNode() 
    : BaseAtom()
    , index(0)
    , numEdges(0)
    , recursiveDepth(0)
    , predecessorEdge(nullptr)
    , outputVertex(nullptr) {
    setFlag(ATOM_IS_MESHNODE);
}

MeshNode::MeshNode(const BaseAtom& other) 
    : BaseAtom()
    , index(0)
    , numEdges(0)
    , recursiveDepth(0)
    , predecessorEdge(nullptr)
    , outputVertex(nullptr) {
    
    tag = other.tag;
    pos = other.pos;
    numNeighbors = 0;
    flags = 0;
    
    setFlag(ATOM_IS_MESHNODE);
    if(other.testFlag(ATOM_DISCLINATION_BORDER)) {
        setFlag(ATOM_DISCLINATION_BORDER);
    }
}

MeshEdge* MeshNode::createEdge(MeshNode* other, const LatticeVector& edgeVector){
    DISLOCATIONS_ASSERT_MSG_GLOBAL(numEdges < MAX_NODE_EDGES, "createEdge()", "Maximum number of edges per node exceeded.");
    DISLOCATIONS_ASSERT_MSG_GLOBAL(other->numEdges < MAX_NODE_EDGES, "createEdge()", "Maximum number of edges per node exceeded.");
    
    MeshEdge& edge = edges[numEdges];
    MeshEdge& oppositeEdge = other->edges[other->numEdges];
    
    edge.node1 = this;
    edge.latticeVector = edgeVector;
    edge.oppositeEdge = &oppositeEdge;
    edge.facet = nullptr;
    edge.nextEdge = nullptr;
    edge.circuit = nullptr;
    edge.outputEdge = nullptr;
    edge.isSFEdge = false;
    
    oppositeEdge.node1 = other;
    oppositeEdge.latticeVector = -edgeVector;
    oppositeEdge.oppositeEdge = &edge;
    oppositeEdge.facet = nullptr;
    oppositeEdge.nextEdge = nullptr;
    oppositeEdge.circuit = nullptr;
    oppositeEdge.outputEdge = nullptr;
    oppositeEdge.isSFEdge = false;
    
    numEdges++;
    other->numEdges++;
    
    return &edge;
}

void MeshNode::moveEdge(int oldIndex, int newIndex){
    if(oldIndex < 0 || oldIndex >= numEdges || newIndex < 0 || newIndex >= numEdges){
        return;
    }
    
    MeshEdge& oldEdge = edges[oldIndex];
    MeshEdge* oppositeEdge = oldEdge.oppositeEdge;
    MeshEdge& newEdge = edges[newIndex];
    
    DISLOCATIONS_ASSERT_GLOBAL(newEdge.node1 == this);
    
    newEdge.latticeVector = oldEdge.latticeVector;
    newEdge.oppositeEdge = oppositeEdge;
    newEdge.facet = oldEdge.facet;
    
    oppositeEdge->oppositeEdge = &newEdge;
    DISLOCATIONS_ASSERT_GLOBAL(oppositeEdge->node2() == this);
    
    if(oldEdge.facet){
        oldEdge.facet->edges[oldEdge.facet->edgeIndex(&oldEdge)] = &newEdge;
    }
}

MeshEdge* MeshNode::findEdgeTo(MeshNode* node) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() == node){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

MeshEdge* MeshNode::findEdgeToTag(int tag) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() && edges[e].node2()->tag == tag){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

MeshEdge* MeshNode::findEdgeWithFacetTo(MeshNode* node) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() == node && edges[e].facet != nullptr){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

MeshEdge* MeshNode::findEdgeWithoutFacetTo(MeshNode* node) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() == node && edges[e].facet == nullptr){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

MeshEdge* MeshNode::findEdgeWithFacetToTag(int tag) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() && edges[e].node2()->tag == tag && edges[e].facet != nullptr){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

MeshEdge* MeshNode::findEdgeWithoutFacetToTag(int tag) const{
    for(int e = 0; e < numEdges; e++){
        if(edges[e].node2() && edges[e].node2()->tag == tag && edges[e].facet == nullptr){
            return const_cast<MeshEdge*>(&edges[e]);
        }
    }
    return nullptr;
}

bool MeshNode::isValid() const{
    if(numEdges < 0 || numEdges > MAX_NODE_EDGES) return false;
    
    for(int i = 0; i < numEdges; i++){
        if(!edges[i].isValid()) return false;
    }
    
    return true;
}

void MeshNode::validate() const{
    DISLOCATIONS_ASSERT_GLOBAL(isValid());
}
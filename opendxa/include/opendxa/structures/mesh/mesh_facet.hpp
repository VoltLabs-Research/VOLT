#ifndef OPENDXA_STRUCTURES_MESH_FACET_HPP
#define OPENDXA_STRUCTURES_MESH_FACET_HPP

#include <opendxa/structures/mesh/mesh_types.hpp>
#include <opendxa/structures/mesh/mesh_edge.hpp>

struct MeshFacet {
    MeshEdge* edges[3];
    BurgersCircuit* circuit;
    unsigned int flags;
    int selection;

    MeshFacet();

    bool testFlag(FacetBitFlags which) const { 
        return (flags & (1 << which)); 
    }
    
    void setFlag(FacetBitFlags which) { 
        flags |= (1 << which); 
    }
    
    void clearFlag(FacetBitFlags which) { 
        flags &= ~(1 << which); 
    }

    MeshNode* vertex(int index) const {
        DISLOCATIONS_ASSERT_GLOBAL(index >= 0 && index < 3);
        return edges[index]->node1; 
    }

    bool hasVertex(MeshNode* v) const;
    int edgeIndex(MeshEdge* e) const;
    MeshEdge* nextEdge(MeshEdge* e) const;
    MeshEdge* previousEdge(MeshEdge* e) const;
    
    bool isValid() const;
    void validate() const;
};

#endif
#ifndef __DXA_INTERFACE_MESH_STRUCT_H
#define __DXA_INTERFACE_MESH_STRUCT_H

#include <opendxa/Includes.hpp>

enum FacetBitFlags {
	FACET_IS_PRIMARY_SEGMENT = 0,
	FACET_IS_UNNECESSARY = 1,
};

struct MeshEdge{
	MeshNode* node1;
	LatticeVector latticeVector;
	MeshFacet* facet;
	MeshEdge* oppositeEdge;
	BurgersCircuit* circuit;
	MeshEdge* nextEdge;
	OutputEdge* outputEdge;
	bool isSFEdge;
	MeshNode* node2() const { return oppositeEdge->node1; }
	void writeToFile(ostream& stream);
};

struct MeshNode : public BaseAtom{
	MeshNode(const BaseAtom& other) {
		tag = other.tag;
		pos = other.pos;
		numNeighbors = 0;
		numEdges = 0;
		flags = 0;
		recursiveDepth = 0;
		outputVertex = NULL;
		setFlag(ATOM_IS_MESHNODE);
		if(other.testFlag(ATOM_DISCLINATION_BORDER))
			setFlag(ATOM_DISCLINATION_BORDER);
	}

	int index;
	int numEdges;
	MeshEdge edges[MAX_NODE_EDGES];
	LatticeVector latticeCoord;
	int recursiveDepth;
	MeshEdge* predecessorEdge;
	OutputVertex* outputVertex;

	MeshNode* edgeNeighbor(int edgeIndex) const {
		DISLOCATIONS_ASSERT_GLOBAL(edgeIndex >= 0 && edgeIndex < numEdges);
		return edges[edgeIndex].node2();
	}

	MeshEdge* createEdge(MeshNode* other, const LatticeVector& edgeVector) {
		// Create new double edge.
		DISLOCATIONS_ASSERT_MSG_GLOBAL(numEdges < MAX_NODE_EDGES, "createEdge()", "Maximum number of edges per node exceeded.");
		DISLOCATIONS_ASSERT_MSG_GLOBAL(other->numEdges < MAX_NODE_EDGES, "createEdge()", "Maximum number of edges per node exceeded.");
		MeshEdge& edge = edges[numEdges];
		MeshEdge& oppositeEdge = other->edges[other->numEdges];
		edge.latticeVector = edgeVector;
		oppositeEdge.latticeVector = -edgeVector;
		edge.oppositeEdge = &oppositeEdge;
		oppositeEdge.oppositeEdge = &edge;
		edge.facet = NULL;
		oppositeEdge.facet = NULL;
		oppositeEdge.node1 = other;
		edge.node1 = this;
		edge.nextEdge = NULL;
		oppositeEdge.nextEdge = NULL;
		edge.circuit = NULL;
		oppositeEdge.circuit = NULL;
		edge.outputEdge = NULL;
		oppositeEdge.outputEdge = NULL;
		edge.isSFEdge = false;
		oppositeEdge.isSFEdge = false;
		numEdges++;
		other->numEdges++;
		return &edge;
	}

	inline void moveEdge(int oldIndex, int newIndex);

	int edgeIndex(MeshEdge* edge) const {
		DISLOCATIONS_ASSERT(edge - edges >= 0 && edge - edges < numEdges);
		return edge - edges;
	}

	MeshEdge* findEdgeTo(MeshNode* node) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2() == node)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}

	MeshEdge* findEdgeToTag(int tag) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2()->tag == tag)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}

	MeshEdge* findEdgeWithFacetTo(MeshNode* node) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2() == node && edges[e].facet != NULL)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}

	MeshEdge* findEdgeWithoutFacetTo(MeshNode* node) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2() == node && edges[e].facet == NULL)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}

	MeshEdge* findEdgeWithFacetToTag(int tag) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2()->tag == tag && edges[e].facet != NULL)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}

	MeshEdge* findEdgeWithoutFacetToTag(int tag) const {
		for(int e = 0; e < numEdges; e++)
			if(edges[e].node2()->tag == tag && edges[e].facet == NULL)
				return const_cast<MeshEdge*>(&edges[e]);
		return NULL;
	}
};

struct MeshFacet
{
	MeshFacet() : circuit(NULL), flags(0), selection(0) {}

	MeshEdge* edges[3];
	BurgersCircuit* circuit;
	unsigned int flags;
	int selection;

	bool testFlag(FacetBitFlags which) const { return (flags & (1<<which)); }
	void setFlag(FacetBitFlags which) { flags |= (1<<which); }
	void clearFlag(FacetBitFlags which) { flags &= ~(1<<which); }

	bool hasVertex(MeshNode* v) const {
		return edges[0]->node1 == v || edges[1]->node1 == v || edges[2]->node1 == v;
	}

	MeshNode* vertex(int index) const {
		DISLOCATIONS_ASSERT_GLOBAL(index >= 0 && index < 3);
		return edges[index]->node1;
	}

	int edgeIndex(MeshEdge* e) const {
		for(int v=0; v<3; v++)
			if(edges[v] == e)
				return v;
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return -1;
	}

	MeshEdge* nextEdge(MeshEdge* e) const {
		if(edges[0] == e) return edges[1];
		if(edges[1] == e) return edges[2];
		if(edges[2] == e) return edges[0];
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return NULL;
	}

	MeshEdge* previousEdge(MeshEdge* e) const {
		if(edges[0] == e) return edges[2];
		if(edges[1] == e) return edges[0];
		if(edges[2] == e) return edges[1];
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return NULL;
	}
};


inline void MeshNode::moveEdge(int oldIndex, int newIndex) {
	MeshEdge& oldEdge = edges[oldIndex];
	MeshEdge* oppositeEdge = oldEdge.oppositeEdge;
	MeshEdge& newEdge = edges[newIndex];
	DISLOCATIONS_ASSERT_GLOBAL(newEdge.node1 == this);
	newEdge.latticeVector = oldEdge.latticeVector;
	newEdge.oppositeEdge = oppositeEdge;
	newEdge.facet = oldEdge.facet;
	oppositeEdge->oppositeEdge = &newEdge;
	DISLOCATIONS_ASSERT_GLOBAL(oppositeEdge->node2() == this);
	if(oldEdge.facet)
		oldEdge.facet->edges[oldEdge.facet->edgeIndex(&oldEdge)] = &newEdge;
}

#endif


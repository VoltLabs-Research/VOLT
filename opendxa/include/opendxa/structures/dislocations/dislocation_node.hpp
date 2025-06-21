#ifndef OPENDXA_DISLOCATION_NODE_HPP
#define OPENDXA_DISLOCATION_NODE_HPP

#include <opendxa/structures/dislocations/dislocation_segment.hpp>

/**
 * A start or end node of a dislocation segment.
 *
 * Each segment has two nodes that mark the beginning and the end of the segment.
*/
struct DislocationNode{
    DislocationNode() : circuit(NULL){
        junctionRing = this; 
    }

    // The dislocation segment to which this node belongs
    DislocationSegment* segment;
    // The opposite node associated with the dislocation segment
    DislocationNode* oppositeNoe;
	// Pointer to the next node in linked list of nodes that form a junction.
	// If this node is not part of a junction, then this pointer points to the node itself.
	DislocationNode* junctionRing;
	// The Burgers circuit associated with this node.
	// This field is only used during dislocation line tracing.
	BurgersCircuit* circuit;
	// Returns the (signed) Burgers vector of the node.
	// This is the Burgers vector of the segment if this node is a forward node,
	// or the negative Burgers vector if this node is a backward node.
	inline ClusterVector burgersVector() const;

	// Returns the position of the node by looking up the coordinates of the
	// start or end point of the dislocation segment to which the node belongs.
	inline const Vector3& position() const;

	// Returns true if this node is the forward node of its segment, that is,
	// when it is at the end of the associated dislocation segment.
	inline bool isForwardNode() const;

	// Returns true if this node is the backward node of its segment, that is,
	// when it is at the beginning of the associated dislocation segment.
	inline bool isBackwardNode() const;

	// Determines whether the given node forms a junction with the given node.
	bool formsJunctionWith(DislocationNode* other) const{
		DislocationNode* n = this->junctionRing;
		do {
			if(other == n) return true;
			n = n->junctionRing;
		}
		while(n != this->junctionRing);
		return false;
	}

	// Makes two nodes part of a junction.
	// If any of the two nodes were already part of a junction, then
	// a single junction is created that encompasses all nodes.
	void connectNodes(DislocationNode* other){
		DISLOCATIONS_ASSERT(!other->formsJunctionWith(this));
		DISLOCATIONS_ASSERT(!this->formsJunctionWith(other));

		DislocationNode* tempStorage = junctionRing;
		junctionRing = other->junctionRing;
		other->junctionRing = tempStorage;

		DISLOCATIONS_ASSERT(other->formsJunctionWith(this));
		DISLOCATIONS_ASSERT(this->formsJunctionWith(other));
	}

	// If this node is part of a junction, dissolves the junction.
	// The nodes of all junction arms will become dangling nodes.
	void dissolveJunction() {
		DislocationNode* n = this->junctionRing;
		while(n != this) {
			DislocationNode* next = n->junctionRing;
			n->junctionRing = n;
			n = next;
		}
		this->junctionRing = this;
	}

	// Counts the number of arms belonging to the junction.
	int countJunctionArms() const{
		int armCount = 1;
		for(DislocationNode* armNode = this->junctionRing; armNode != this; armNode = armNode->junctionRing){
			armCount++;
        }
		return armCount;
	}

	/// Return whether the end of a segment, represented by this node, does not merge into a junction.
	bool isDangling() const{
		DISLOCATIONS_ASSERT(circuit == NULL || (junctionRing == this) == circuit->isDangling);
		return (junctionRing == this);
	}
};

#endif
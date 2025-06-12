#ifndef __DXA_DISLOCATIONS_STRUCT_H
#define __DXA_DISLOCATIONS_STRUCT_H

#include <opendxa/Includes.hpp>
#include <opendxa/structures/InterfaceMesh.hpp>

struct BurgersCircuit{
	MeshEdge* firstEdge;
	MeshEdge* lastEdge;
	DislocationSegment* segment;
	int edgeCount;
	BurgersCircuit* oppositeCircuit;
	BurgersCircuit* junctionRing;
	vector<MeshEdge*> primarySegmentCap;
	bool isEnclosed;
	bool isDangling;

	BurgersCircuit() : isDangling(true) { junctionRing = this; }

	LatticeVector calculateBurgersVector() const {
		LatticeVector b(NULL_VECTOR);
		MeshEdge* edge = firstEdge;
		do {
			DISLOCATIONS_ASSERT_GLOBAL(edge != NULL);
			b += edge->latticeVector;
			edge = edge->nextEdge;
		}
		while(edge != firstEdge);
		return b;
	}

	inline LatticeVector burgersVector() const;

	void updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell) const;
	void updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell, MeshNode* node) const;

	Point3 calculateCenter(const Point3& refPoint, const AnalysisEnvironment& simCell) const {
		Vector3 center(NULL_VECTOR);
		MeshEdge* edge = firstEdge;
		do {
			DISLOCATIONS_ASSERT_GLOBAL(edge != NULL);
			center += simCell.wrapVector(edge->node1->pos - refPoint);
			edge = edge->nextEdge;
		}
		while(edge != firstEdge);
		center.X /= edgeCount;
		center.Y /= edgeCount;
		center.Z /= edgeCount;
		return refPoint + center;
	}

	inline const Point3& center() const;

	int countEdges() const {
		int count = 0;
		MeshEdge* edge = firstEdge;
		do {
			DISLOCATIONS_ASSERT_GLOBAL(edge != NULL);
			count++;
			edge = edge->nextEdge;
		}
		while(edge != firstEdge);
		return count;
	}

	void createPrimaryCap() {
		primarySegmentCap.reserve(edgeCount);
		MeshEdge* edge = firstEdge;
		do {
			primarySegmentCap.push_back(edge);
			edge = edge->nextEdge;
		}
		while(edge != firstEdge);
	}

	bool isInRing(BurgersCircuit* other) const {
		BurgersCircuit* c = junctionRing;
		do {
			DISLOCATIONS_ASSERT_GLOBAL(c != NULL);
			if(other == c) return true;
			c = c->junctionRing;
		}
		while(c != this->junctionRing);
		return false;
	}

	void joinRings(BurgersCircuit* other) {
		BurgersCircuit* tempStorage = junctionRing;
		junctionRing = other->junctionRing;
		other->junctionRing = tempStorage;

		DISLOCATIONS_ASSERT_GLOBAL(other->isInRing(this));
		DISLOCATIONS_ASSERT_GLOBAL(isInRing(other));
	}

	/// Returns the i-th edge of the circuit.
	MeshEdge* getEdge(int index) const {
		DISLOCATIONS_ASSERT_GLOBAL(index >= 0);
		MeshEdge* edge = firstEdge;
		for(; index != 0; index--) {
			edge = edge->nextEdge;
		}
		return edge;
	}

	inline bool isForwardCircuit() const;
	inline bool isBackwardCircuit() const;

	void writeToFile(ostream& stream);
	void writeCapToFile(ostream& stream);
};

struct DislocationSegment
{
	DislocationSegment(const LatticeVector& b, const Vector3& bWorld) : burgersVector(b), burgersVectorWorld(bWorld), replacedWith(NULL), V(NULL_MATRIX), W(NULL_MATRIX) {
		circuits[0] = circuits[1] = NULL;
		displacementCount = 0;
	}

	DislocationSegment(const LatticeVector& b, BurgersCircuit* forwardCircuit, BurgersCircuit* backwardCircuit, const Point3& refPoint, const AnalysisEnvironment& simCell) :
		burgersVector(b), primarySegmentStart(0), primarySegmentEnd(2), replacedWith(NULL), V(NULL_MATRIX), W(NULL_MATRIX) {
		circuits[0] = forwardCircuit;
		circuits[1] = backwardCircuit;
		circuits[0]->segment = this;
		circuits[1]->segment = this;
		circuits[0]->oppositeCircuit = circuits[1];
		circuits[1]->oppositeCircuit = circuits[0];

		// Add the first two points to the line.
		line.push_back(backwardCircuit->calculateCenter(refPoint, simCell));
		line.push_back(forwardCircuit->calculateCenter(refPoint, simCell));

		displacementCount = 0;
	}

	int index;
	deque<Point3> line;
	vector<Vector3> displacement;
	int displacementCount;
	LatticeVector burgersVector;
	Vector3 burgersVectorWorld;
	BurgersCircuit* circuits[2];
	size_t primarySegmentStart;
	size_t primarySegmentEnd;
	DislocationSegment* replacedWith;
	Matrix3 V,W;

	BurgersCircuit* forwardCircuit() const { return circuits[0]; }
	BurgersCircuit* backwardCircuit() const { return circuits[1]; }

	void recordLinePoint(BurgersCircuit* circuit, bool isPrimarySegment, const AnalysisEnvironment& simCell) {
		DISLOCATIONS_ASSERT_GLOBAL(!line.empty());
		if(circuit == forwardCircuit()) {
			line.push_back(circuit->calculateCenter(line.back(), simCell));
			if(isPrimarySegment == true) primarySegmentEnd++;
		}
		else {
			DISLOCATIONS_ASSERT(circuit == backwardCircuit());
			line.push_front(circuit->calculateCenter(line.front(), simCell));
			primarySegmentEnd++;
			if(isPrimarySegment == false) primarySegmentStart++;
		}
	}

	bool isClosedLoop() const {
		return (circuits[0]->isDangling == false) && (circuits[0]->junctionRing == circuits[1]) && (circuits[1]->junctionRing == circuits[0]);
	}

	FloatType calculateLength() const {
		FloatType length = 0.0;
		deque<Point3>::const_iterator i1 = line.begin();
		for(;;) {
			deque<Point3>::const_iterator i2 = i1 + 1;
			if(i2 == line.end()) break;
			length += Distance(*i1, *i2);
			i1 = i2;
		}
		return length;
	}

	void determineWorldBurgersVector();
};

inline bool BurgersCircuit::isForwardCircuit() const { return segment->forwardCircuit() == this; }
inline bool BurgersCircuit::isBackwardCircuit() const { return segment->backwardCircuit() == this; }

inline LatticeVector BurgersCircuit::burgersVector() const {
	if(isForwardCircuit())
		return segment->burgersVector;
	else
		return -segment->burgersVector;
}

inline const Point3& BurgersCircuit::center() const {
	if(isForwardCircuit())
		return segment->line.back();
	else
		return segment->line.front();
}

#endif


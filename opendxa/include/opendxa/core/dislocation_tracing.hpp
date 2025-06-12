#ifndef __DXA_TRACING_H
#define __DXA_TRACING_H

#include <opendxa/includes.hpp>
#include <opendxa/core/interface_mesh.hpp>

class DXATracing : public DXAInterfaceMesh{
public:
	DXATracing();
	~DXATracing() { cleanup(); }

	void setMaximumBurgersCircuitSize(int maxSize) { this->maxBurgersCircuitSize = maxSize; burgersSearchDepth = (maxSize - 1) / 2; }
	void setMaximumExtendedBurgersCircuitSize(int maxSize) { this->maxExtendedBurgersCircuitSize = maxSize; }

	void traceDislocationSegments();
	void smoothDislocationSegments(int smoothingLevel, int coarseningLevel);
	void wrapDislocationSegments();
	void clipDislocationLines(const Point3& clipOrigin, const Matrix3& clipCell);
	void generateOutputMesh();
	const vector<DislocationSegment*>& getSegments() const { return this->segments; }
	void writeDislocationsVTKFile(ostream& stream) const;
	void cleanup();

protected:
	void findPrimarySegments();
	bool burgersSearchWalkEdge(MeshNode* currentNode, MeshEdge& edge, vector<MeshNode*>& visitedNodes, deque<MeshNode*>& toprocess);
	void traceSegment(DislocationSegment& segment, BurgersCircuit& circuit, int maxCircuitLength, bool isPrimarySegment);
	int joinSegments(int maxCircuitLength);
	BurgersCircuit* buildBackwardCircuit(BurgersCircuit* forwardCircuit);
	void createSecondarySegment(MeshEdge* firstEdge, BurgersCircuit* outerCircuit, int maxCircuitLength);
	void circuitContourIntersection(MeshEdge* contourEdge1, MeshEdge* contourEdge2, MeshEdge* circuitEdge1, MeshEdge* circuitEdge2, int& goingOutside, int& goingInside);
	bool tryRemoveTwoCircuitEdges(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2);
	bool tryRemoveThreeCircuitEdges(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment);
	bool tryRemoveOneCircuitEdge(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment);
	bool trySweepTwoFacets(MeshEdge*& edge0, MeshEdge*& edge1, MeshEdge*& edge2, bool isPrimarySegment);
	bool tryInsertOneCircuitEdge(MeshEdge*& edge0, MeshEdge*& edge1, bool isPrimarySegment);
	void recordLinePoint(BurgersCircuit* circuit, bool isPrimarySegment);

	vector<BurgersCircuit*> danglingCircuits;
	MemoryPool<BurgersCircuit> circuitPool;
	vector<DislocationSegment*> segments;
	MemoryPool<DislocationSegment> segmentPool;

	int burgersSearchDepth;
	int maxBurgersCircuitSize;
	int maxExtendedBurgersCircuitSize;
	BurgersCircuit* unusedCircuit;
};

#endif // __DXA_TRACING_H


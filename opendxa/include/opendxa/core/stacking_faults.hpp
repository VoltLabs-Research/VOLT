#ifndef __DXA_STACKING_FAULTS_H
#define __DXA_STACKING_FAULTS_H

#include <opendxa/includes.hpp>
#include <opendxa/engine/config.hpp>
#include <opendxa/core/dislocation_tracing.hpp>
#include <opendxa/structures/dislocations/dislocation_segment.hpp>
#include <opendxa/structures/dislocations/burgers_circuit.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class DXAStackingFaults : public DXATracing{
public:
	DXAStackingFaults();
	~DXAStackingFaults() { cleanup(); }

	bool createStackingFaultEdges();
	void findStackingFaultPlanes();
	void findSFDislocationContours();
	void finishStackingFaults(FloatType flatten = DEFAULT_SF_FLATTEN_LEVEL);
	void cleanup();
	json compute(const OpenDXA::Config &config);
	json getStackingFaults() const;

protected:
	void traceStackingFaultContour(StackingFault* sf, StackingFaultContour& contour, deque< pair<InputAtom*, Point3> >& toprocess, Point3 currentUnwrappedPos, set<MeshEdge*>& visitedEdges, const LatticeVector hexagonalLatticeVectors[6], int currentDir);
	bool isValidStackingFaultContourEdge(MeshEdge* edge, const LatticeVector& node1LatticeVector, const LatticeVector& node2LatticeVector) const;
	BaseAtom* findEdgeBasalPlaneNeighbor(MeshEdge* edge, const LatticeVector& node1LatticeVector, const LatticeVector& node2LatticeVector) const;
	void recursiveWalkSFAtom(InputAtom* atom, StackingFault* sf, Point3 unwrappedPos, deque< pair<InputAtom*, Point3> >& toprocess);
	void createSFPolylines(FloatType flatten);
	pair<int,int> findSFContourSegmentIntersection(StackingFaultContour& contour, DislocationSegment* segment, const vector<MeshEdge*>::const_iterator& interiorEdge);
	void addMeshIntervalToSFPolyline(StackingFaultContour& contour, int startIndex, int endIndex, Point3& wrappedPoint, Point3& unwrappedPoint);
	void addDislocationIntervalToSFPolyline(StackingFaultContour& contour, BurgersCircuit* startCircuit, Point3& wrappedPoint, Point3& unwrappedPoint);
	void splitPolylineSegment2(StackingFault* sf, SFContourVertex* vertex1, int dim, const Vector3& projectionDir, multimap<FloatType, SFContourVertex*> clipVertices[2]);
	bool isInsideStackingFault(StackingFault* sf, SFContourVertex* vertexHead, const Point3 p);
	bool isInsideStackingFaultRay(StackingFault* sf, SFContourVertex* vertexHead, const Point3 p);

	SFContourVertex* createSFVertex(StackingFault* sf, const Point3& pos) {
		SFContourVertex* vertex = stackingFaultVertexPool.construct();
		vertex->pos = pos;
		vertex->image = Vector3I((int)floor(pos.X), (int)floor(pos.Y), (int)floor(pos.Z));
		vertex->unwrappedPos = pos;
		vertex->next = NULL;
		vertex->previous = NULL;
		vertex->flags = 0;
		vertex->globalNext = sf->globalVertexList;
		sf->globalVertexList = vertex;
		return vertex;
	}

	vector<StackingFault*> stackingFaults;
	MemoryPool<StackingFault> stackingFaultPool;
	MemoryPool<SFContourVertex> stackingFaultVertexPool;
	OutputMesh stackingFaultOutputMesh;

	friend class SFTessellator;
};

#endif


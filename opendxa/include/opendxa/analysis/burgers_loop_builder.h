#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/memory_pool.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/interface_mesh.h>
#include <boost/random/uniform_int_distribution.hpp>
#include <boost/random/mersenne_twister.hpp>
#include <boost/random/uniform_int.hpp>

namespace OpenDXA{

class BurgersLoopBuilder{
public:
	BurgersLoopBuilder(InterfaceMesh& mesh, ClusterGraph* clusterGraph, int maxTrialCircuitSize, int maxCircuitElongation) :
		_mesh(mesh),
		_clusterGraph(clusterGraph),
		_network(new DislocationNetwork(clusterGraph)),
		_unusedCircuit(nullptr),
		_edgeStartIndex(0),
		_maxBurgersCircuitSize(maxTrialCircuitSize),
		_maxExtendedBurgersCircuitSize(maxTrialCircuitSize + maxCircuitElongation){}

	const InterfaceMesh& mesh() const{
		return _mesh;
	}

	ClusterGraph& clusterGraph(){
		return *_clusterGraph;
	}

	DislocationNetwork& network(){
		return *_network;
	}

	const DislocationNetwork& network() const{
		return *_network;
	}

	const SimulationCell& cell() const{
		return mesh().structureAnalysis().cell();
	}

	bool traceDislocationSegments();
	void finishDislocationSegments(int crystalStructure);

	const std::vector<DislocationNode*>& danglingNodes() const{
		return _danglingNodes;
	}

private:
	BurgersCircuit* allocateCircuit();
	BurgersCircuit* buildReverseCircuit(BurgersCircuit* forwardCircuit);

	void discardCircuit(BurgersCircuit* circuit);
	void createAndTraceSegment(const ClusterVector& burgersVector, BurgersCircuit* forwardCircuit, int maxCircuitLength);
	void traceSegment(DislocationSegment& segment, DislocationNode& node, int maxCircuitLength, bool isPrimarySegment);
	void appendLinePoint(DislocationNode& node);
	void circuitCircuitIntersection(InterfaceMesh::Edge* circuitAEdge1, InterfaceMesh::Edge* circuitAEdge2, InterfaceMesh::Edge* circuitBEdge1, InterfaceMesh::Edge* circuitBEdge2, int& goingOutside, int& goingInside);
	void createSecondarySegment(InterfaceMesh::Edge* firstEdge, BurgersCircuit* outerCircuit, int maxCircuitLength);

	bool findPrimarySegments(int maxBurgersCircuitSize);
	bool createBurgersCircuit(InterfaceMesh::Edge* edge, int maxBurgersCircuitSize);
	bool intersectsOtherCircuits(BurgersCircuit* circuit);
	bool tryRemoveTwoCircuitEdges(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2);
	bool tryRemoveThreeCircuitEdges(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool tryRemoveOneCircuitEdge(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool trySweepTwoFacets(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool tryInsertOneCircuitEdge(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, bool isPrimarySegment);

	size_t joinSegments(int maxCircuitLength);

	Vector3 calculateShiftVector(const Point3& a, const Point3& b) const{
		Vector3 d = cell().absoluteToReduced(b - a);
		d.x() = cell().pbcFlags()[0] ? floor(d.x() + double(0.5)) : double(0);
		d.y() = cell().pbcFlags()[1] ? floor(d.y() + double(0.5)) : double(0);
		d.z() = cell().pbcFlags()[2] ? floor(d.z() + double(0.5)) : double(0);
		return cell().reducedToAbsolute(d);
	}

	InterfaceMesh& _mesh;
	std::shared_ptr<DislocationNetwork> _network;
	ClusterGraph* _clusterGraph; 
	tbb::spin_mutex _circuit_pool_mutex;
	
	int _maxBurgersCircuitSize;
	int _maxExtendedBurgersCircuitSize;

	MemoryPool<BurgersCircuit> _circuitPool;
	boost::random::mt19937 _rng;
	std::vector<DislocationNode*> _danglingNodes;
	BurgersCircuit* _unusedCircuit;
	mutable size_t _edgeStartIndex;  
};

}

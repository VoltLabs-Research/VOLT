#pragma once

#include <opendxa/analysis/delaunay_tessellation_spatial_query.h>
#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/memory_pool.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/interface_mesh.h>
#include <unordered_set>
#include <unordered_map>
#include <random>
#include <mutex>

namespace OpenDXA{

class BurgersLoopBuilder{
public:
	BurgersLoopBuilder(InterfaceMesh& mesh, ClusterGraph* clusterGraph, int maxTrialCircuitSize, int maxCircuitElongation, bool markCoreAtoms) :
		_mesh(mesh),
		_clusterGraph(clusterGraph),
		_network(new DislocationNetwork(clusterGraph)),
		_unusedCircuit(nullptr),
		_markCoreAtoms(markCoreAtoms),
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
		return mesh().structureAnalysis().context().simCell;
	}

	void traceDislocationSegments();
	void finishDislocationSegments(int crystalStructure);

	const std::vector<DislocationNode*>& danglingNodes() const{
		return _danglingNodes;
	}
	
	std::unordered_set<int> _coreAtomIndices;
    std::vector<std::pair<DislocationNode*, bool>> _cellDataForCoreAtomIdentification;
private:
	BurgersCircuit* allocateCircuit();
	BurgersCircuit* buildReverseCircuit(BurgersCircuit* forwardCircuit);

	void discardCircuit(BurgersCircuit* circuit);
	void createAndTraceSegment(const ClusterVector& burgersVector, BurgersCircuit* forwardCircuit, int maxCircuitLength);
	void traceSegment(DislocationSegment& segment, DislocationNode& node, int maxCircuitLength, bool isPrimarySegment);
	void appendLinePoint(DislocationNode& node);
	void circuitCircuitIntersection(InterfaceMesh::Edge* circuitAEdge1, InterfaceMesh::Edge* circuitAEdge2, InterfaceMesh::Edge* circuitBEdge1, InterfaceMesh::Edge* circuitBEdge2, int& goingOutside, int& goingInside);
	void createSecondarySegment(InterfaceMesh::Edge* firstEdge, BurgersCircuit* outerCircuit, int maxCircuitLength);
	void findPrimarySegments(int maxBurgersCircuitSize);
	void identifyNodeCoreAtoms(DislocationNode& node, const Point3& newPoint);

    struct SearchNode {
        InterfaceMesh::Vertex* node;
        Point3 coord;
        Matrix3 tm;
        int depth;
        InterfaceMesh::Edge* viaEdge;
    };

	bool createBurgersCircuit(InterfaceMesh::Edge* edge, int maxBurgersCircuitSize, const std::unordered_map<InterfaceMesh::Vertex*, SearchNode*>& visited_map);
	bool intersectsOtherCircuits(BurgersCircuit* circuit);
	bool tryRemoveTwoCircuitEdges(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2);
	bool tryRemoveThreeCircuitEdges(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool tryRemoveOneCircuitEdge(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool trySweepTwoFacets(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, InterfaceMesh::Edge*& edge2, bool isPrimarySegment);
	bool tryInsertOneCircuitEdge(InterfaceMesh::Edge*& edge0, InterfaceMesh::Edge*& edge1, bool isPrimarySegment);

	void joinSegments(int maxCircuitLength);

	Vector3 calculateShiftVector(const Point3& a, const Point3& b) const{
        if(cell().hasPbc(0) || cell().hasPbc(1) || cell().hasPbc(2)) {
            Vector3 d = cell().absoluteToReduced(b - a);
            d.x() = cell().hasPbc(0) ? std::floor(d.x() + double(0.5)) : double(0);
            d.y() = cell().hasPbc(1) ? std::floor(d.y() + double(0.5)) : double(0);
            d.z() = cell().hasPbc(2) ? std::floor(d.z() + double(0.5)) : double(0);
            return cell().reducedToAbsolute(d);
        }else{
            return b - a;
        }
    }

	InterfaceMesh& _mesh;
	std::shared_ptr<DislocationNetwork> _network;
	ClusterGraph* _clusterGraph; 
	tbb::spin_mutex _circuit_pool_mutex;

	bool _markCoreAtoms;

	int _maxBurgersCircuitSize;
	int _maxExtendedBurgersCircuitSize;
    std::optional<DelaunayTessellationSpatialQuery> _spatialQuery;

	MemoryPool<BurgersCircuit> _circuitPool;
	std::mt19937 rng;
	std::vector<DislocationNode*> _danglingNodes;
	BurgersCircuit* _unusedCircuit;
	mutable size_t _edgeStartIndex;  
    mutable std::mutex _builderMutex;
};

}

#pragma once

#include <cassert>
#include <cstddef>
#include <vector>

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/cluster_vector.h>
#include <opendxa/geometry/interface_mesh.h>

namespace OpenDXA{

struct DislocationNode;

struct BurgersCircuit{
	InterfaceMesh::Edge* firstEdge = nullptr;
    InterfaceMesh::Edge* lastEdge = nullptr;
    std::vector<InterfaceMesh::Edge*> segmentMeshCap;
    std::size_t numPreliminaryPoints = 0;
    DislocationNode* dislocationNode = nullptr;
    std::size_t edgeCount = 0;
    bool isCompletelyBlocked = false;
    bool isDangling = true;

	BurgersCircuit() noexcept = default;

	[[nodiscard]]
	ClusterVector calculateBurgersVector() const noexcept{
		Vector3 b{};
		Matrix3 tm = Matrix3::Identity();
		auto* edge = firstEdge;

		do{
			assert(edge);
			b += tm * edge->clusterVector;
			if(!edge->clusterTransition->isSelfTransition()){
				tm = tm * edge->clusterTransition->reverse->tm;
			}

			edge = edge->nextCircuitEdge;
		}while(edge != firstEdge);

		return ClusterVector(b, firstEdge->clusterTransition->cluster1);
	}

	[[nodiscard]]
	Point3 calculateCenter() const noexcept{
		Vector3 center{};
		Vector3 current{};
		auto* edge = firstEdge;

		do{
			assert(edge);
			center += current;
			current += edge->physicalVector;
			edge = edge->nextCircuitEdge;
		}while(edge != firstEdge);

		return firstEdge->vertex1()->pos() + (center / static_cast<double>(edgeCount));
	}

	[[nodiscard]]
	size_t countEdges() const noexcept{
		size_t cnt = 0;
		auto *edge = firstEdge;
		do{
			assert(edge);
			++cnt;
			edge = edge->nextCircuitEdge;
		}while(edge != firstEdge);
		return cnt;
	}

	[[nodiscard]]
	InterfaceMesh::Edge* getEdge(size_t idx) const noexcept{
		assert(idx < edgeCount);
		auto *edge = firstEdge;
		while(idx--){
			edge = edge->nextCircuitEdge;
		}
		return edge;
	}

	void storeCircuit() noexcept{
		assert(segmentMeshCap.empty());
		segmentMeshCap.reserve(edgeCount);
		auto* edge = firstEdge;
		do{
			segmentMeshCap.push_back(edge);
			edge = edge->nextCircuitEdge;
		}while(edge != firstEdge);
		assert(segmentMeshCap.size() >= 2);
	}
};

}
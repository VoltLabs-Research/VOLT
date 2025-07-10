#pragma once

#include <cassert>
#include <cstddef>
#include <vector>

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/cluster_vector.h>
#include <opendxa/geometry/interface_mesh.h>

namespace OpenDXA{

// Represents one node in the dislocation network.
struct DislocationNode;

// A cloosed loop (circuit) of mesh edges used to detect dislocations.
// In a perfect crystal, summing the ideal lattice vectors around such a loop
// should cancel to zero. Any nonzero result is the Burger vector, which indicates
// the magnitudes and direction of the dislocation.
struct BurgersCircuit{
	// Starting half-edge of the loop
	InterfaceMesh::Edge* firstEdge = nullptr;

	// Most recently added half-edge
    InterfaceMesh::Edge* lastEdge = nullptr;

	// Copy of the loop edges for later reference
    std::vector<InterfaceMesh::Edge*> segmentMeshCap;

	// Number of points recorded before trimming/merging
    std::size_t numPreliminaryPoints = 0;

	// Owning node in the dislocation segment
    DislocationNode* dislocationNode = nullptr;

	// Current number of half-edges in the circuit
    std::size_t edgeCount = 0;

	// True if the loop is fully surrounded by others
    bool isCompletelyBlocked = false;

	// True if the circuit has not yet been closed into a segment
    bool isDangling = true;

	BurgersCircuit() noexcept = default;

	// Sum up the lattice displacement around the loop to get the Burgers vector.
	// The displacement of each edge is stored in edge->clusterVector. We follow
	// each edge in turn, accumulating its contribution, and apply any necessary
	// symmetry transition if the edge crosses from one grain to another.
	[[nodiscard]]
	ClusterVector calculateBurgersVector() const noexcept{
		Vector3 b{};
		Matrix3 tm = Matrix3::Identity();
		auto* edge = firstEdge;

		do{
			assert(edge);
			// Add this edge's vector, after transforming from its original grain
			b += tm * edge->clusterVector;

			// If this edge crosses a grain boundary, update the transformation
			if(!edge->clusterTransition->isSelfTransition()){
				tm = tm * edge->clusterTransition->reverse->tm;
			}

			edge = edge->nextCircuitEdge;
		}while(edge != firstEdge);

		// The Burgers vector lives in the cluster of the first edge
		return ClusterVector(b, firstEdge->clusterTransition->cluster1);
	}

	// Compute the geometric center of the loop in real space.
	// We walk the half-edges in order, summing their physical displacements
	// to find the centroid of the circuit. This point is used as a line
	// interpolation anchor when tracing dislocation lines.
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

		// The base position of the circuit is the position of the first edge's start vertex
		return firstEdge->vertex1()->pos() + (center / static_cast<double>(edgeCount));
	}

	// Count how many edges currently compose the loop.
	// This walks from firstEdge through each nextCircuitEdge until returning
	// to the start, verifying consistency with edgeCount.
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

	// Retrieve the NTh edge in the loop.
	// Allows indexed access during segment construction or trimming.
	[[nodiscard]]
	InterfaceMesh::Edge* getEdge(size_t idx) const noexcept{
		assert(idx < edgeCount);
		auto *edge = firstEdge;
		while(idx--){
			edge = edge->nextCircuitEdge;
		}
		return edge;
	}

	// Copy the current loop edges into segmentMeshCap for safe-keeping.
	// After trimming or merging operations, we may want to revisit the
	// original loop geometry; this method reserves space and stores 
	// each half-edge pointer in order.
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
#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/analysis/burgers_circuit.h>
#include <opendxa/structures/cluster_vector.h>
#include <tbb/spin_mutex.h>
#include <memory>
#include <vector>
#include <deque>
#include <algorithm>
#include <ranges>
#include <cmath>

namespace OpenDXA{

struct DislocationSegment;

struct DislocationNode{
	DislocationSegment* segment = nullptr;
	DislocationNode* oppositeNode = nullptr;
	DislocationNode* junctionRing = nullptr;
	BurgersCircuit* circuit = nullptr;
	
	DislocationNode() = default;

	[[nodiscard]] inline ClusterVector burgersVector() const;
	[[nodiscard]] inline const Point3& position() const;
	[[nodiscard]] inline bool isForwardNode() const;
	[[nodiscard]] inline bool isBackwardNode() const;
	
	[[nodiscard]] inline bool isDangling() const{
		return junctionRing == this;
	}

	bool formsJunctionWith(DislocationNode* other) const{
		for(auto *node = junctionRing; ; node = node->junctionRing){
			if(node == other) return true;
			if(node == this) break;
		}

		return false;
	}

	void connectNodes(DislocationNode* other){
		assert(!formsJunctionWith(other));
		assert(!other->formsJunctionWith(this));
		std::swap(junctionRing, other->junctionRing);
		assert(formsJunctionWith(other));
		assert(other->formsJunctionWith(this));
	}

	void dissolveJunction(){
		for(auto *node = junctionRing; node != this;){
			auto *next = node->junctionRing;
			node->junctionRing = node;
			node = next;
		}

		junctionRing = this;
	}

	int countJunctionArms() const{
		int count = 1;
		for(auto *node = junctionRing; node != this; node = node->junctionRing){
			++count;
		}

		return count;
	}
};

struct DislocationSegment{
	int id;
	std::deque<Point3> line;
	std::deque<int> coreSize;
	ClusterVector burgersVector;
	DislocationNode* nodes[2];
	DislocationSegment* replacedWith;

DislocationSegment(const ClusterVector& b, DislocationNode* forward, DislocationNode* backward)
	: id(-1), burgersVector(b), replacedWith(nullptr){
	assert(b.localVec() != Vector3::Zero());

	nodes[0] = forward;
	nodes[1] = backward;

	// Primero asigna punteros
	forward->segment = this;
	forward->oppositeNode = backward;
	forward->junctionRing = forward;

	backward->segment = this;
	backward->oppositeNode = forward;
	backward->junctionRing = backward;
}


	[[nodiscard]] DislocationNode &forwardNode() const{
		return *nodes[0];
	}

	[[nodiscard]] DislocationNode& backwardNode() const{
		return *nodes[1];
	}

	[[nodiscard]] bool isClosedLoop() const{
		return (nodes[0]->junctionRing == nodes[1]) && (nodes[1]->junctionRing == nodes[0]);
	}

	[[nodiscard]] bool isInfiniteLine() const{
		return isClosedLoop() && !line.front().equals(line.back(), CA_ATOM_VECTOR_EPSILON);
	}

	[[nodiscard]] bool isDegenerate() const{
		return line.size() <= 1;
	}

	[[nodiscard]] double calculateLength() const{
		assert(!isDegenerate());
		double length = 0.0;
		for(auto i = line.begin(); std::next(i) != line.end(); ++i){
			// Usando Eigen para cálculo optimizado de distancia
			auto p1 = Eigen::Vector3d(i->x(), i->y(), i->z());
			auto p2 = Eigen::Vector3d(std::next(i)->x(), std::next(i)->y(), std::next(i)->z());
			length += (p2 - p1).norm();
		}
		return length;
	}

	void flipOrientation(){
		burgersVector = -burgersVector;
		std::swap(nodes[0], nodes[1]);
		std::ranges::reverse(line);
		std::ranges::reverse(coreSize);
	}

	[[nodiscard]] Point3 getPointOnLine(double t) const;
};

inline bool DislocationNode::isForwardNode() const{
	return &segment->forwardNode() == this;
}

inline bool DislocationNode::isBackwardNode() const{
	return &segment->backwardNode() == this;
}

inline ClusterVector DislocationNode::burgersVector() const{
	return isForwardNode() ? segment->burgersVector : -segment->burgersVector;
}

/// Returns the position of the node by looking up the coordinates of the
/// start or end point of the dislocation segment to which the node belongs.
inline const Point3& DislocationNode::position() const{
	return isForwardNode() ? segment->line.back() : segment->line.front();
}

class DislocationNetwork{
public:
	DislocationNetwork(ClusterGraph* clusterGraph)
		: _clusterGraph(std::shared_ptr<ClusterGraph>(clusterGraph, [](ClusterGraph*){})){}

	DislocationNetwork(const DislocationNetwork &other);

	[[nodiscard]] const ClusterGraph &clusterGraph() const{
		return *_clusterGraph;
	}

	[[nodiscard]] const std::vector<DislocationSegment*>& segments() const{
		return _segments;
	}

	void smoothDislocationLine(double smoothingLevel, std::deque<Point3>& line, bool isLoop);
	void smoothDislocationLines(double lineSmoothingLevel, double linePointInterval);
	void coarsenDislocationLine(
		double linePointInterval,
		const std::deque<Point3>& input,
		const std::deque<int>& coreSize,
		std::deque<Point3>& output,
		std::deque<int>& outputCoreSize,
		bool isClosedLoop,
		bool isInfiniteLine
	);

	DislocationSegment* createSegment(const ClusterVector& burgersVector);
	void discardSegment(DislocationSegment* segment);

private:
	std::shared_ptr<ClusterGraph> _clusterGraph;
	MemoryPool<DislocationNode> _nodePool;
	std::vector<DislocationSegment*> _segments;
	MemoryPool<DislocationSegment> _segmentPool;
};

}
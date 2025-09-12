#pragma once
#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/bounded_priority_queue.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/utilities/memory_pool.h>

#define TREE_DEPTH_LIMIT 17

namespace OpenDXA{
class NearestNeighborFinder{
protected:
	struct NeighborListAtom{
		NeighborListAtom* nextInBin;
		Point3 pos;
	};

	struct TreeNode {
		TreeNode() : splitDim(-1), atoms(nullptr), numAtoms(0){}

		bool isLeaf() const;
		void convertToAbsoluteCoordinates(const SimulationCell& cell);

		int splitDim;
		union{
			struct{
				TreeNode* children[2];
				double splitPos;
			};

			struct{
				NeighborListAtom* atoms;
				int numAtoms;
			};
		};

		Box3 bounds;
	};

public:
	NearestNeighborFinder(int _numNeighbors = 16) : numNeighbors(_numNeighbors), numLeafNodes(0), maxTreeDepth(1){
		bucketSize = std::max(_numNeighbors / 2, 8);
	}

	size_t particleCount() const{
		return atoms.size();
	}

	bool prepare(ParticleProperty* posProperty, const SimulationCell& cellData, ParticleProperty* selectionProperty = nullptr);

	const Point3& particlePos(size_t index) const;

	struct Neighbor{
		Vector3 delta;
		double distanceSq;
		NeighborListAtom* atom;
		size_t index;

		bool operator<(const Neighbor& other) const{
			return distanceSq < other.distanceSq;
		}
	};

	template<int MAX_NEIGHBORS_LIMIT>
	class Query{
	public:
		Query(const NearestNeighborFinder& finder) : t(finder), queue(finder.numNeighbors) {}
		void findNeighbors(size_t particleIndex, bool includeSelf);
		void findNeighbors(const Point3& query_point, bool includeSelf);
		void findNeighbors(size_t particleIndex);
		void findNeighbors(const Point3& query_point);

		const BoundedPriorityQueue<Neighbor, std::less<Neighbor>, MAX_NEIGHBORS_LIMIT>& results() const { return queue; }

	private:
		void visitNode(TreeNode* node);
		void visitNode(TreeNode* node, bool includeSelf);

	private:
		const NearestNeighborFinder& t;
		Point3 q, qr;
		BoundedPriorityQueue<Neighbor, std::less<Neighbor>, MAX_NEIGHBORS_LIMIT> queue;
	};

protected:
	void insertParticle(NeighborListAtom* atom, const Point3& p, TreeNode* node, int depth);
	void splitLeafNode(TreeNode* node, int splitDim);

    int determineSplitDirection(TreeNode* node);

	double minimumDistance(TreeNode* node, const Point3& query_point) const;

	std::vector<NeighborListAtom> atoms;
	SimulationCell simCell;
	Vector3 planeNormals[3];
	MemoryPool<TreeNode> nodePool;
	TreeNode* root;
	int numNeighbors;
	int bucketSize;
	std::vector<Vector3> pbcImages;
	int numLeafNodes;
	int maxTreeDepth;
};

}
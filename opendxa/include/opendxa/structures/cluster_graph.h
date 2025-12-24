#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/cluster.h>
#include <opendxa/utilities/memory_pool.h>

namespace OpenDXA{

class ClusterGraph{
public:
	ClusterGraph();
	~ClusterGraph();
	ClusterGraph(const ClusterGraph& other);

	[[nodiscard]] const std::vector<Cluster*>& clusters() const{
		return _clusters;
	}

	[[nodiscard]] const std::vector<ClusterTransition*>& clusterTransitions() const{
		return _clusterTransitions; 
	}

	Cluster* createCluster(int structureType, int id = -1);
	Cluster* findCluster(int id) const;

	ClusterTransition* createClusterTransition(Cluster* clusterA, Cluster* clusterB, const Matrix3& tm, int distance = 1);
	ClusterTransition* determineClusterTransition(Cluster* clusterA, Cluster* clusterB);
	ClusterTransition* createSelfTransition(Cluster* cluster);
	ClusterTransition* concatenateClusterTransitions(ClusterTransition* tAB, ClusterTransition* tBC);

private:

	std::vector<Cluster*> _clusters;
	std::map<int, Cluster*> _clusterMap;

	std::vector<ClusterTransition*> _clusterTransitions;
	MemoryPool<Cluster> _clusterPool;
	MemoryPool<ClusterTransition> _clusterTransitionPool;

	std::set<std::pair<Cluster*, Cluster*>> _disconnectedClusters;

	int _maximumClusterDistance;
    mutable tbb::spin_mutex mutex;
};

}
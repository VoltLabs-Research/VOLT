#include <opendxa/core/opendxa.h>
#include <opendxa/structures/cluster_graph.h>
#include <tbb/spin_mutex.h>

namespace OpenDXA{

// Manages a collection of clusters (group of atoms) and the transitions (misorientations)
// between them. Transitions are connections that describe how one cluster's orientation
// transform into another's.
ClusterGraph::ClusterGraph() : _maximumClusterDistance(2){
	createCluster(0, 0);
}

ClusterGraph::~ClusterGraph(){
	_clusters.clear();
	_clusterTransitions.clear();
	_clusterMap.clear();
	_disconnectedClusters.clear();
}

ClusterGraph::ClusterGraph(const ClusterGraph& other){
	// TODO
	assert(false);
	_maximumClusterDistance = other._maximumClusterDistance;
}

// Create a new cluster node with the given structure type and optional ID.
// If no ID is provided, one is assigned sequentially.
Cluster* ClusterGraph::createCluster(int structureType, int id){
    tbb::spin_mutex::scoped_lock lock(mutex);
	if(id < 0){
		id = clusters().size();
		assert(id > 0);
	}

	Cluster* cluster = _clusterPool.construct(id, structureType);
	_clusters.push_back(cluster);

	bool inserted = _clusterMap.insert({ id, cluster }).second;
	assert(inserted);

	return cluster;
}

// Look up a cluster by its numric ID, or nullptr if not found.
Cluster* ClusterGraph::findCluster(int id) const{
	assert(id >= 0);
	if(id < static_cast<int>(clusters().size()) && clusters()[id]->id == id){
		return clusters()[id];
	}

	auto iter = _clusterMap.find(id);
	return iter == _clusterMap.end() ? nullptr : iter->second;
}

// Define a transition (edge) between two clusters A -> B with a given rotation matrix tm.
// Also automatically created the reserve transition B -> A. Distance is a small integer
// ranking (1 for direct neighbors, higher for composed paths).
ClusterTransition* ClusterGraph::createClusterTransition(Cluster* clusterA, Cluster* clusterB, const Matrix3& tm, int distance){
	// If we're linking a cluster to itself and the rotation is identity, create a self-loop
	if(clusterA == clusterB && tm.equals(Matrix3::Identity(), CA_TRANSITION_MATRIX_EPSILON)){
		return createSelfTransition(clusterA);
	}

	assert(distance >= 1);

	// Reuse any existing identical transition
	for(auto *transition = clusterA->transitions; transition; transition = transition->next){
		if(transition->cluster2 == clusterB && transition->tm.equals(tm, CA_TRANSITION_MATRIX_EPSILON)){
			return transition;
		}
	}

	// Build the forward and reverse transition objects
    tbb::spin_mutex::scoped_lock lock(mutex);
	ClusterTransition* tAB = _clusterTransitionPool.construct();
	ClusterTransition* tBA = _clusterTransitionPool.construct();

	tAB->cluster1 = clusterA;
	tAB->cluster2 = clusterB;

	tBA->cluster1 = clusterB;
	tBA->cluster2 = clusterA;

	tAB->tm = tm;
	tBA->tm = tm.inverse();

	tAB->reverse = tBA;
	tBA->reverse = tAB;

	tAB->distance = distance;
	tBA->distance = distance;

	tAB->area = 0;
	tBA->area = 0;

	clusterA->insertTransition(tAB);
	clusterB->insertTransition(tBA);

	_clusterTransitions.push_back(tAB);

	if(distance == 1){
		// Reset any cahced "disconnected" lookups when a new direct link appears
		_disconnectedClusters.clear();
	}

	return tAB;
}

// Create a trivial "self transition" on a cluster, marking it as identity
// (distance 0) so algorithms can always assume at least one transition exists.
ClusterTransition* ClusterGraph::createSelfTransition(Cluster* cluster){
	assert(cluster && cluster->id != 0);

	// If there's already a self-transition at the head, return it
	if(cluster->transitions && cluster->transitions->isSelfTransition()){
		return cluster->transitions;
	}

    tbb::spin_mutex::scoped_lock lock(mutex);
	ClusterTransition* transition = _clusterTransitionPool.construct();
	transition->cluster1 = cluster;
	transition->cluster2 = cluster;
	transition->tm.setIdentity();
	transition->reverse = transition;
	transition->distance = 0;
	transition->next = cluster->transitions;
	transition->area = 0;
	cluster->transitions = transition;

	assert(transition->isSelfTransition());
	assert(!transition->next || transition->next->distance >= 1);

	return transition;
}

// Find or build the shortest known transition from A to B by exploring A -> X -> B paths
// up to a small distance. If no path exists, record that A and B are disconnected.
ClusterTransition* ClusterGraph::determineClusterTransition(Cluster* clusterA, Cluster* clusterB){
	assert(clusterA && clusterB);

	// Self-lookup is trivial
	if(clusterA == clusterB){
		return createSelfTransition(clusterA);
	}

	// First scan direct transitions
	for(auto *transition = clusterA->transitions; transition; transition = transition->next){
		assert(!transition->next || transition->next->distance >= transition->distance);
		if(transition->cluster2 == clusterB){
			return transition;
		}
	}

	// If neither has any non-self links yet, we can bail out.
	if(!clusterA->transitions || (clusterA->transitions->isSelfTransition() && !clusterA->transitions->next)){
		return nullptr;
	}

	if(!clusterB->transitions || (clusterB->transitions->isSelfTransition() && !clusterB->transitions->next)){
		return nullptr;
	}

	// Enforce a consistent search order to avoid duplicating "disconnected" pairs
	bool reversedSearch = false;
	if(clusterA->id > clusterB->id){
		reversedSearch = true;
		std::swap(clusterA, clusterB);
	}

	// If we already known they're disconnected, skip
    {
        tbb::spin_mutex::scoped_lock lock(mutex);
        if(_disconnectedClusters.contains({ clusterA, clusterB })){
            return nullptr;
        }
    }

	// Try all 2-step path A -> X -> B and pick the shortest distance
	assert(_maximumClusterDistance == 2);
	int shortestDistance = _maximumClusterDistance + 1;
	ClusterTransition* shortestPath1 = nullptr;
	ClusterTransition* shortestPath2 = nullptr;

	for(auto *t1 = clusterA->transitions; t1; t1 = t1->next){
		// Skip self
		if(t1->cluster2 == clusterA) continue;

		for(auto* t2 = t1->cluster2->transitions; t2; t2 = t2->next){
			if(t2->cluster2 == clusterB){
				int distance = t1->distance + t2->distance;
				if(distance < shortestDistance){
					shortestDistance = distance;
					shortestPath1 = t1;
					shortestPath2 = t2;
				}

				break;
			}
		}
	}

	if(shortestPath1){
		ClusterTransition* newT = createClusterTransition(clusterA, clusterB, shortestPath2->tm * shortestPath1->tm, shortestDistance);
		return reversedSearch ? newT->reverse : newT;
	}

	// Record that no path exists under the allowed maximum
    tbb::spin_mutex::scoped_lock lock(mutex);
	_disconnectedClusters.insert({ clusterA, clusterB });
	return nullptr;
}

// Given two existing transitions A -> B and B -> C, splice them into A -> C in one step
ClusterTransition* ClusterGraph::concatenateClusterTransitions(ClusterTransition* tAB, ClusterTransition* tBC){
	assert(tAB && tBC && tAB->cluster2 == tBC->cluster1);

	if(tBC->isSelfTransition()) return tAB;
	if(tAB->isSelfTransition()) return tBC;

	// A -> B then B -> A is equivalent to A -> A 
	if(tAB->reverse == tBC){
		return createSelfTransition(tAB->cluster1);
	}

	assert(tAB->distance >= 1 && tBC->distance >= 1);
	return createClusterTransition(
		tAB->cluster1, 
		tBC->cluster2, 
		tBC->tm * tAB->tm, 
		tAB->distance + tBC->distance
	);
}

}
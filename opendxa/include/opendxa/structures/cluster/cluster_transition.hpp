#ifndef OPENDXA_CLUSTER_TRANSITION_HPP
#define OPENDXA_CLUSTER_TRANSITION_HPP

#include <opendxa/structures/structures.hpp>

struct ClusterTransition{
	Cluster* cluster1;
	Cluster* cluster2;
	int numberOfBonds;
	int priority;
	bool disabled;
	ClusterTransition* next;
	ClusterTransition* inverse;
	LatticeOrientation transitionTM;

	ClusterTransition* originalNext;
	Cluster* originalCluster1;
	Cluster* originalCluster2;
	LatticeOrientation originalTransitionTM;
};

#endif
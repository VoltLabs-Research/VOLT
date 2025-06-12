#ifndef __DXA_CLUSTER_STRUCT_H
#define __DXA_CLUSTER_STRUCT_H

#include <opendxa/structures/Structures.hpp>

struct Cluster {
	int id;
	int processor;
	Cluster* masterCluster;
	Cluster* nextCluster;
	LatticeOrientation transformation;
	ClusterTransition* transitions;
	ClusterTransition* originalTransitions;
	int numTransitions;

	inline void removeTransition(ClusterTransition* t);
};

struct ClusterTransition {
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

inline void Cluster::removeTransition(ClusterTransition* t)
{
	if(transitions == t) {
		transitions = t->next;
		t->next = NULL;
		numTransitions--;
		return;
	}
	ClusterTransition* iter = transitions;
#ifdef DEBUG_DISLOCATIONS
	int counter = 0;
#endif
	while(iter) {
#ifdef DEBUG_DISLOCATIONS
		DISLOCATIONS_ASSERT_GLOBAL(counter < numTransitions);
		counter++;
#endif
		if(iter->next == t) {
			iter->next = t->next;
			t->next = NULL;
			numTransitions--;
			return;
		}
		iter = iter->next;
	}
	DISLOCATIONS_ASSERT_GLOBAL(false);
}

#endif


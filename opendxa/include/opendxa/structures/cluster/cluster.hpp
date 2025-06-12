#ifndef OPENDXA_CLUSTER_HPP
#define OPENDXA_CLUSTER_HPP

#include <opendxa/structures/structures.hpp>

struct Cluster{
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

// TODO: Should I leave this here? Probably not.
inline void Cluster::removeTransition(ClusterTransition* t){
    if(transitions == t){
        transitions = t->next;
        t->next = NULL;
        numTransitions--;
        return;
    }

    ClusterTransition* iter = transitions;
    // int counter = 0;

    while(iter){
        // DISLOCATIONS_ASSERT_GLOBAL(counter < numTransitions);
        // counter++;

        if(iter->next == t){
            iter->next = t->next;
            t->next = NULL;
            numTransitions--;
            return;
        }

        iter = iter->next;
    }

    // shouldn't get here
}

#endif
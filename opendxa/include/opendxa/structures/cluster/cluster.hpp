#ifndef OPENDXA_STRUCTURES_CLUSTER_HPP
#define OPENDXA_STRUCTURES_CLUSTER_HPP

#include <opendxa/structures/structures.hpp>

struct ClusterTransition;

struct Cluster {
    int id;
    int processor;
    Cluster* masterCluster;
    Cluster* nextCluster;
    LatticeOrientation transformation;
    ClusterTransition* transitions;
    ClusterTransition* originalTransitions;
    int numTransitions;

    Cluster();
    
    ~Cluster();

    void removeTransition(ClusterTransition* t);
    
    bool hasTransition(ClusterTransition* t) const;
    void addTransition(ClusterTransition* t);
    void clearTransitions();
    
    bool isValid() const;
    int countTransitions() const;
};

#endif 
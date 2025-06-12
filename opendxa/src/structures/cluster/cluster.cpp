#include <opendxa/structures/cluster/cluster.hpp>
#include <opendxa/structures/cluster/cluster_transition.hpp>

Cluster::Cluster() 
    : id(0)
    , processor(0)
    , masterCluster(nullptr)
    , nextCluster(nullptr)
    , transformation()
    , transitions(nullptr)
    , originalTransitions(nullptr)
    , numTransitions(0) {
}

Cluster::~Cluster(){
    clearTransitions();
}

void Cluster::removeTransition(ClusterTransition* t){
    if(!t) return;
    if(transitions == t){
        transitions = t->next;
        t->next = nullptr;
        numTransitions--;
        return;
    }

    ClusterTransition* iter = transitions;
    while(iter){
        if(iter->next == t){
            iter->next = t->next;
            t->next = nullptr;
            numTransitions--;
            return;
        }
        iter = iter->next;
    }
    
    DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "removeTransition()", "Transition not found in cluster.");
}

bool Cluster::hasTransition(ClusterTransition* t) const{
    ClusterTransition* iter = transitions;
    while(iter){
        if(iter == t) return true;
        iter = iter->next;
    }
    return false;
}

void Cluster::addTransition(ClusterTransition* t){
    if(!t) return;
    
    t->next = transitions;
    transitions = t;
    numTransitions++;
}

void Cluster::clearTransitions(){
    while(transitions){
        ClusterTransition* next = transitions->next;
        transitions->next = nullptr;
        transitions = next;
    }
    numTransitions = 0;
}

bool Cluster::isValid() const{
    return countTransitions() == numTransitions;
}

int Cluster::countTransitions() const{
    int count = 0;
    ClusterTransition* iter = transitions;
    while(iter){
        count++;
        iter = iter->next;
    }
    return count;
}
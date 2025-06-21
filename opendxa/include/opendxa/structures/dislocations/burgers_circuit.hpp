#ifndef OPENDXA_STRUCTURES_BURGERS_CIRCUIT_HPP
#define OPENDXA_STRUCTURES_BURGERS_CIRCUIT_HPP

#include <vector>
#include <iosfwd> 
#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/utils/linalg/lattice_vector.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

struct DislocationSegment;
struct MeshEdge;
struct MeshNode;

struct BurgersCircuit{
    MeshEdge* firstEdge;
    MeshEdge* lastEdge;
    DislocationSegment* segment;
    int edgeCount;
    BurgersCircuit* oppositeCircuit;
    BurgersCircuit* junctionRing;
    std::vector<MeshEdge*> primarySegmentCap;
    bool isEnclosed;
    bool isDangling;

    BurgersCircuit();

    Vector3 burgersVector() const;
    const Point3& center() const;
    bool isForwardCircuit() const;
    bool isBackwardCircuit() const;
    
    void createPrimaryCap();
    MeshEdge* getEdge(int index) const;
    int countEdges() const;
    Point3 calculateCenter(const Point3& refPoint, const AnalysisEnvironment& simCell) const;
    Vector3 calculateBurgersVector() const;
    
    void updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell) const;
    void updateLatticeToWorldTransformation(const AnalysisEnvironment& simCell, MeshNode* node) const;
    
    json getBurgersCircuit();

    bool isInRing(BurgersCircuit* other) const{
        BurgersCircuit* c = junctionRing;
        do{
            DISLOCATIONS_ASSERT_GLOBAL(c != nullptr);
            if(other == c) return true;
            c = c->junctionRing;
        }while(c != this->junctionRing);
        return false;
    }

    void joinRings(BurgersCircuit* other) {
        BurgersCircuit* tempStorage = junctionRing;
        junctionRing = other->junctionRing;
        other->junctionRing = tempStorage;

        DISLOCATIONS_ASSERT_GLOBAL(other->isInRing(this));
        DISLOCATIONS_ASSERT_GLOBAL(isInRing(other));
    }
};

#endif
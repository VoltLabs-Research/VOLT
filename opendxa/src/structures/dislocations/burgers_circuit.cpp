#include <opendxa/structures/dislocations/burgers_circuit.hpp>
#include <opendxa/structures/dislocations/dislocation_segment.hpp>
#include <opendxa/structures/mesh/mesh.hpp>
#include <iostream>

BurgersCircuit::BurgersCircuit() : isDangling(true){
    junctionRing = this;
    firstEdge = nullptr;
    lastEdge = nullptr;
    segment = nullptr;
    edgeCount = 0;
    oppositeCircuit = nullptr;
    isEnclosed = false;
}

bool BurgersCircuit::isForwardCircuit() const{
    return segment->forwardCircuit() == this;
}

bool BurgersCircuit::isBackwardCircuit() const{
    return segment->backwardCircuit() == this;
}

Vector3 BurgersCircuit::burgersVector() const{
    if(isForwardCircuit()){
        return segment->burgersVector;
    }else{
        return -segment->burgersVector;
    }
}

const Point3& BurgersCircuit::center() const{
    if(isForwardCircuit()){
        return segment->line.back();
    }else{
        return segment->line.front();
    }
}

void BurgersCircuit::createPrimaryCap(){
    primarySegmentCap.reserve(edgeCount);
    MeshEdge* edge = firstEdge;
    do{
        primarySegmentCap.push_back(edge);
        edge = edge->nextEdge;
    }while(edge != firstEdge);
}

MeshEdge* BurgersCircuit::getEdge(int index) const{
    DISLOCATIONS_ASSERT_GLOBAL(index >= 0);
    MeshEdge* edge = firstEdge;
    for(; index != 0; index--){
        edge = edge->nextEdge;
    }
    return edge;
}

int BurgersCircuit::countEdges() const{
    int count = 0;
    MeshEdge* edge = firstEdge;

    do{
        DISLOCATIONS_ASSERT_GLOBAL(edge != nullptr);
        count++;
        edge = edge->nextEdge;
    }while(edge != firstEdge);

    return count;
}

Point3 BurgersCircuit::calculateCenter(const Point3& refPoint, const AnalysisEnvironment& simCell) const{
    Vector3 center(NULL_VECTOR);
    MeshEdge* edge = firstEdge;
    do{
        DISLOCATIONS_ASSERT_GLOBAL(edge != nullptr);
        center += simCell.wrapVector(edge->node1->pos - refPoint);
        edge = edge->nextEdge;
    }while(edge != firstEdge);

    center.X /= edgeCount;
    center.Y /= edgeCount;
    center.Z /= edgeCount;

    return refPoint + center;
}

Vector3 BurgersCircuit::calculateBurgersVector() const{
    Vector3 b(NULL_VECTOR);
    MeshEdge* edge = firstEdge;
    do{
        DISLOCATIONS_ASSERT_GLOBAL(edge != nullptr);
        b += edge->latticeVector;
        edge = edge->nextEdge;
    }while(edge != firstEdge);
    return b;
}
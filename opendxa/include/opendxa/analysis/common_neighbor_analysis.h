#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/neighbor_bond_array.h>
#include <opendxa/structures/coordination_structure.h>

namespace OpenDXA{

class CommonNeighborAnalysis{
public:
    enum CNAMode{
        FixedCutoffMode,
        AdaptiveCutoffMode
    };

    typedef unsigned int CNAPairBond;

    double cutoff() const{
        return _cutoff;
    }

    void setCutoff(double newCutoff){
        _cutoff = newCutoff;
    }

    CNAMode mode() const{
        return _cnaMode;
    }

    void setMode(CNAMode mode){
        _cnaMode = mode;
    }

    static int findCommonNeighbors(
        const NeighborBondArray& neighborArray, 
        int neighborIndex, 
        unsigned int &commonNeighbors, 
        int numNeighbors);

    static int findNeighborBonds(
        const NeighborBondArray& neighborArray, 
        unsigned int commonNeighbors, 
        int numNeighbors, 
        CNAPairBond* neighborBonds);

    static int calcMaxChainLength(CNAPairBond* neighborBonds, int numBonds);
	static void generateCellTooSmallError(int dimension);
    static bool findMatchingNeighborPermutation(
        CoordinationStructureType coordinationType,
        int* neighborMapping,
        int* previousMapping,
        int coordinationNumber,
        const int* cnaSignatures,
        const NeighborBondArray& neighborArray,
        const CoordinationStructure* coordinationStructures
    );

    static CoordinationStructureType computeCoordinationType(
        const NeighborBondArray& neighborArray,
        int coordinationNumber,
        int* cnaSignatures,
        LatticeStructureType inputCrystalType,
        bool identifyPlanarDefects
    );

private:
    static int getAdjacentBonds(
        unsigned int atom,
        CNAPairBond* bondsToProcess,
        int& numBonds,
        unsigned int& atomsToProcess,
        unsigned int& atomsProcessed
    );
    
    double _cutoff;
    CNAMode _cnaMode;
};

}
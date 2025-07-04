#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/lattice_structure.h>
#include <opendxa/structures/coordination_structure.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/core/particle_property.h>

namespace OpenDXA{
    
class CoordinationStructures{
public:
    CoordinationStructures(ParticleProperty* structureTypes, LatticeStructureType inputCrystalType, bool identifyPlanarDefects, const SimulationCell& simCell);

    double determineLocalStructure(NearestNeighborFinder& neighList, size_t particleIndex, std::shared_ptr<ParticleProperty> neighborLists);
    static void initializeStructures();

    static const LatticeStructure& latticeStructure(int structureIndex){
        return _latticeStructures[structureIndex];
    }

    static CoordinationStructure _coordinationStructures[NUM_COORD_TYPES];
    static LatticeStructure _latticeStructures[NUM_LATTICE_TYPES];
    
    // CNA (REFACTOR)
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

    const SimulationCell& cell() const{
        return _simCell;
    }
    
    static int findCommonNeighbors(const NeighborBondArray& neighborArray, int neighborIndex, unsigned int &commonNeighbors, int numNeighbors);
    static int findNeighborBonds(const NeighborBondArray& neighborArray, unsigned int commonNeighbors, int numNeighbors, CNAPairBond* neighborBonds);
    static int calcMaxChainLength(CNAPairBond* neighborBonds, int numBonds);
	static void generateCellTooSmallError(int dimension);

private:
    static int getAdjacentBonds(
        unsigned int atom,
        CNAPairBond* bondsToProcess,
        int& numBonds,
        unsigned int& atomsToProcess,
        unsigned int& atomsProcessed
    );
    
    const SimulationCell& _simCell;
    bool _identifyPlanarDefects;
    ParticleProperty* _structureTypes;
    LatticeStructureType _inputCrystalType;
    double _cutoff;
    CNAMode _cnaMode;
};

}
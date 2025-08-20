#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/lattice_structure.h>
#include <opendxa/structures/coordination_structure.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/analysis/common_neighbor_analysis.h>
#include <opendxa/structures/lattice_vectors.h>

namespace OpenDXA{
    
class CoordinationStructures{
public:
    CoordinationStructures(ParticleProperty* structureTypes, LatticeStructureType inputCrystalType, bool identifyPlanarDefects, const SimulationCell& simCell);

    double determineLocalStructure(
        const NearestNeighborFinder& neighList, 
        int particleIndex,
        std::shared_ptr<ParticleProperty> neighborLists
    ) const;
    
    static void initializeStructures();

    static const LatticeStructure& latticeStructure(int structureIndex){
        return _latticeStructures[structureIndex];
    }

    static CoordinationStructure _coordinationStructures[NUM_COORD_TYPES];
    static LatticeStructure _latticeStructures[NUM_LATTICE_TYPES];

    const SimulationCell& cell() const{
        return _simCell;
    }

    static void generateCellTooSmallError(int dimension);

private:
    int getCoordinationNumber() const;

    CoordinationStructureType computeCoordinationType(
        const NeighborBondArray& neighborArray,
        int coordinationNumber,
        int* cnaSignatures
    ) const;

    static void initializeDiamondStructure(
        int coordType, 
        int latticeType,
        const Vector3* vectors, 
        int numNeighbors, 
        int totalVectors
    );

    static void initializeLatticeStructure(
        int latticeType, 
        const Vector3* vectors, 
        int totalVectors,
        CoordinationStructure* coordStruct
    );

    template <typename BondPredicate, typename SignatureFunction>
    static void initializeCoordinationStructure(
        int coordType,
        const Vector3* vectors,
        int numNeighbors,
        BondPredicate bondPredicate,
        SignatureFunction signatureFunction
    );

    static void initializeFCC();
    static void initializeHCP();
    static void initializeBCC();
    static void initializeCubicDiamond();
    static void initializeHexagonalDiamond();
    static void initializeOther();
    
    double computeLocalCutoff(
        const NearestNeighborFinder& neighList, 
        const NearestNeighborFinder::Query<MAX_NEIGHBORS>& neighQuery,
        int numNeighbors,
        int coordinationNumber,
        int particleIndex,
        int* neighborIndices,
        Vector3* neighborVectors,
        NeighborBondArray& neighborArray
    ) const;

    static void calculateSymmetryProducts(LatticeStructure& latticeStruct);
    static void findNonCoplanarVectors(const CoordinationStructure& coordStruct, int nindices[3], Matrix3& tm1);
    static void generateSymmetryPermutations(LatticeStructure& latticeStruct);
    static void initializeSymmetryInformation();
    static void findCommonNeighborsForBond(CoordinationStructure& coordStruct, int neighborIndex);
    static void initializeCommonNeighbors();

    static void calculateProductForPermutation(
        LatticeStructure& latticeStruct, 
        int s1, 
        int s2);

    static void findAllSymmetryPermutations(
        LatticeStructure& latticeStruct,
        const CoordinationStructure& coordStruct,
        std::vector<int>& permutation,
        const int nindices[3],
        const Matrix3& tm1,
        const Matrix3& tm1inverse);
        
    const SimulationCell& _simCell;
    bool _identifyPlanarDefects;
    ParticleProperty* _structureTypes;
    LatticeStructureType _inputCrystalType;
};

}
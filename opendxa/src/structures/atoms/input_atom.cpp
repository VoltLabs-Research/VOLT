#include <opendxa/structures/atoms/input_atom.hpp>
#include <opendxa/structures/cluster/cluster.hpp>
#include <opendxa/structures/lattice.hpp>

InputAtom::InputAtom() 
    : BaseAtom()
    , cnaType(UNDEFINED)
    , latticeOrientation()
    , cluster(nullptr)
    , nextInBin(nullptr)
    , pbcImage(){
    initializeNeighborArray();
}

InputAtom::InputAtom(const BaseAtom& other) 
    : BaseAtom(other)
    , cnaType(UNDEFINED)
    , latticeOrientation()
    , cluster(nullptr)
    , nextInBin(nullptr)
    , pbcImage(){
    initializeNeighborArray();
}

bool InputAtom::neighborBond(int neighborIndex1, int neighborIndex2) const{
    if(!isValidBondIndices(neighborIndex1, neighborIndex2)){
        return false;
    }
    
    return(neighborArray[neighborIndex1] &(1 << neighborIndex2)) != 0;
}

void InputAtom::setNeighborBond(int neighborIndex1, int neighborIndex2, bool bonded){
    if(!isValidBondIndices(neighborIndex1, neighborIndex2)){
        DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "setNeighborBond()", "Invalid neighbor indices.");
        return;
    }
    
    if(bonded){
        neighborArray[neighborIndex1] |=(1 << neighborIndex2);
        neighborArray[neighborIndex2] |=(1 << neighborIndex1);
    } else{
        neighborArray[neighborIndex1] &= ~(1 << neighborIndex2);
        neighborArray[neighborIndex2] &= ~(1 << neighborIndex1);
    }
}

void InputAtom::setCNAType(CNAAtomType type){
    cnaType = type;
    
    if(isFCC() || isHCP() || isBCC()){
        setFlag(ATOM_IS_CRYSTALLINE);
    } else{
        clearFlag(ATOM_IS_CRYSTALLINE);
    }
}

const CrystalLatticeType& InputAtom::latticeType() const{
    return latticeTypeFromCNA(cnaType);
}

LatticeVector InputAtom::latticeNeighborVector(int neighborIndex) const{
    const CrystalLatticeType& lattice = latticeType();
    DISLOCATIONS_ASSERT(neighborIndex >= 0 && neighborIndex < lattice.numNeighbors);
    return latticeOrientation * lattice.neighborVectors[neighborIndex];
}

bool InputAtom::isValidTransitionNeighbor(int neighborIndex) const{
    switch(cnaType){
        case FCC:
        case HCP:
            return neighborIndex >= 0 && neighborIndex < numNeighbors;
        case BCC:
            return neighborIndex >= 0 && neighborIndex < 8;
        default:
            return false;
    }
}

LatticeOrientation InputAtom::determineTransitionMatrix(int neighborIndex) const{
    switch(cnaType){
        case FCC:
        case HCP:
            return determineTransitionMatrixFCCHCP(neighborIndex);
        case BCC:
            return determineTransitionMatrixBCC(neighborIndex);
        default:
            DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "determineTransitionMatrix()", "Called for a non-crystalline atom.");
            return IDENTITY;
    }
}

void InputAtom::initializeNeighborArray(){
    for(int i = 0; i < MAX_CRYSTALLINE_ATOM_NEIGHBORS; i++){
        neighborArray[i] = 0;
    }
}

void InputAtom::validateBonds() const{
    for(int i = 0; i < numNeighbors; i++){
        for(int j = i + 1; j < numNeighbors; j++){
            bool bond_ij = neighborBond(i, j);
            bool bond_ji = neighborBond(j, i);
            DISLOCATIONS_ASSERT_GLOBAL(bond_ij == bond_ji);
        }
    }
}

bool InputAtom::isValidBondIndices(int idx1, int idx2) const{
    return idx1 >= 0 && idx1 < numNeighbors && 
           idx2 >= 0 && idx2 < numNeighbors &&
           idx1 < MAX_CRYSTALLINE_ATOM_NEIGHBORS &&
           idx2 < MAX_CRYSTALLINE_ATOM_NEIGHBORS;
}
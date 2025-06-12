#ifndef OPENDXA_INPUT_ATOMS_HPP
#define OPENDXA_INPUT_ATOMS_HPP

#include <opendxa/structures/structures.hpp>

struct InputAtom : public BaseAtom{
    CNAAtomType cnaType;
	LatticeOrientation latticeOrientation;
	unsigned int neighborArray[MAX_CRYSTALLINE_ATOM_NEIGHBORS];
	Cluster* cluster;

    union {
        InputAtom* nextInBin;
		int defectProximity;
		int recursiveDepth;
    };

    Vector3I pbcImage;

    inline InputAtom* neighborAtom(int index) const {
		return reinterpret_cast<InputAtom*>(neighbor(index));
	}

	inline bool neighborBond(int neighborIndex1, int neighborIndex2) const{
		DISLOCATIONS_ASSERT(neighborIndex1 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex2 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex1 >= 0 && neighborIndex1 < numNeighbors);
		DISLOCATIONS_ASSERT(neighborIndex2 >= 0 && neighborIndex2 < numNeighbors);
		return (neighborArray[neighborIndex1] & (1<<neighborIndex2));
	}

	void setNeighborBond(int neighborIndex1, int neighborIndex2, bool bonded){
		DISLOCATIONS_ASSERT(neighborIndex1 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex2 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex1 >= 0 && neighborIndex1 < numNeighbors);
		DISLOCATIONS_ASSERT(neighborIndex2 >= 0 && neighborIndex2 < numNeighbors);
		if(bonded){
			neighborArray[neighborIndex1] |= (1<<neighborIndex2);
			neighborArray[neighborIndex2] |= (1<<neighborIndex1);
		}else{
			neighborArray[neighborIndex1] &= ~(1<<neighborIndex2);
			neighborArray[neighborIndex2] &= ~(1<<neighborIndex1);
		}
	}

	inline bool isFCC() const{
        return cnaType == FCC;
    }

	inline bool isNonFCC() const{
        return cnaType != FCC;
    }

	inline bool isHCP() const{
        return cnaType == HCP;
    }

	inline bool isNonHCP() const{
        return cnaType != HCP;
    }

	inline bool isBCC() const{
        return cnaType == BCC;
    }

	inline bool isNonBCC() const{
        return cnaType != BCC;
    }

	void setCNAType(CNAAtomType type){
		cnaType = type;
		if(isFCC() || isHCP() || isBCC()){
			setFlag(ATOM_IS_CRYSTALLINE);
        }else{
			clearFlag(ATOM_IS_CRYSTALLINE);
        }
	}

	inline const CrystalLatticeType& latticeType() const{
		return latticeTypeFromCNA(cnaType);
	}

	LatticeVector latticeNeighborVector(int neighborIndex) const{
		const CrystalLatticeType& lattice = latticeType();
		DISLOCATIONS_ASSERT(neighborIndex >= 0 && neighborIndex < lattice.numNeighbors);
		return latticeOrientation * lattice.neighborVectors[neighborIndex];
	}

	inline bool isLocalAtom() const{
        return testFlag(ATOM_IS_LOCAL_ATOM);
    }

	inline bool isNonLocalAtom() const{
        return !testFlag(ATOM_IS_LOCAL_ATOM);
    }

	bool isValidTransitionNeighbor(int neighborIndex) const{
		switch(cnaType){
            case FCC:
            case HCP:
                return true;
            case BCC:
                return neighborIndex < 8;
            default:
                return false;
		}
	}

	LatticeOrientation determineTransitionMatrix(int neighborIndex) const{
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

	LatticeOrientation determineTransitionMatrixFCCHCP(int neighborIndex) const;
	LatticeOrientation determineTransitionMatrixBCC(int neighborIndex) const;
};

#endif
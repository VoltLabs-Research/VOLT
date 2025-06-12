#ifndef __DXA_ATOMS_H
#define __DXA_ATOMS_H

#include <opendxa/includes.hpp>
#include <opendxa/structures/structures.hpp>
#include <opendxa/structures/lattice.hpp>

enum AtomBitFlags {
	ATOM_VISITED = 0,
	ATOM_IS_MESHNODE = 1,
	ATOM_NON_BULK = 2,
	ATOM_SHARED_NODE = 3,
	ATOM_IS_CRYSTALLINE = 4,
	ATOM_ON_THE_STACK = 5,
	ATOM_IS_LOCAL_ATOM = 6,
	ATOM_DISCLINATION_BORDER = 7,
	ATOM_DISABLED_GHOST = 8,
	ATOM_ISF = 9,
	ATOM_TB = 10,
};

union BaseAtomNeighbor {
	BaseAtom* pointer;
	int tag;
};

struct BaseAtom{
	int tag;
	Point3 pos;
	int numNeighbors;
	BaseAtomNeighbor neighbors[MAX_ATOM_NEIGHBORS];
	unsigned int flags;

	inline BaseAtom* neighbor(int index) const {
		DISLOCATIONS_ASSERT_GLOBAL(index < numNeighbors);
		return neighbors[index].pointer;
	}

	inline void setNeighbor(int index, BaseAtom* atom) {
		DISLOCATIONS_ASSERT_GLOBAL(index < numNeighbors);
		neighbors[index].pointer = atom;
	}

	inline bool hasNeighbor(const BaseAtom* other) const {
		for(int i = 0; i < numNeighbors; i++)
			if(neighbors[i].pointer == other) return true;
		return false;
	}

	inline bool hasNeighbor(const BaseAtom* other, int testUptoIndex) const {
		for(int i = 0; i < numNeighbors && i < testUptoIndex; i++)
			if(neighbors[i].pointer == other) return true;
		return false;
	}

	inline bool hasNeighborTag(int neighborTag) const {
		for(int i = 0; i < numNeighbors; i++)
			if(neighbors[i].pointer && neighbors[i].pointer->tag == neighborTag)
				return true;
		return false;
	}

	inline int neighborIndex(const BaseAtom* neighbor) const {
		for(int ni = 0; ni < numNeighbors; ni++) {
			if(neighbors[ni].pointer == neighbor)
				return ni;
		}
		DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndex()", "The given atom is not in the neighbor list.");
		return -1;
	}

	inline int neighborIndexTag(int neighborTag) const {
		for(int ni = 0; ni < numNeighbors; ni++) {
			if(neighbors[ni].pointer && neighbors[ni].pointer->tag == neighborTag)
				return ni;
		}
		DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndexTag()", "The given atom is not in the neighbor list.");
		return -1;
	}

	inline void addNeighbor(BaseAtom* neighbor) {
		if(hasNeighbor(neighbor)) {
			cout << "Atom " << tag << " has already a neighbor: " << neighbor->tag;
		}
		DISLOCATIONS_ASSERT_GLOBAL(hasNeighbor(neighbor) == false);
		DISLOCATIONS_ASSERT_MSG_GLOBAL(numNeighbors < MAX_ATOM_NEIGHBORS, "addNeighbor()", "Maximum number of nearest neighbors per atom was exceeded.");
		neighbors[numNeighbors++].pointer = neighbor;
	}

	inline bool testFlag(AtomBitFlags which) const { return (flags & (1 << which)); }
	inline void setFlag(AtomBitFlags which) { flags |= (1 << which); }
	inline void clearFlag(AtomBitFlags which) { flags &= ~(1 << which); }
	inline bool isCrystalline() const { return testFlag(ATOM_IS_CRYSTALLINE); }
	inline bool isDisordered() const { return testFlag(ATOM_IS_CRYSTALLINE) == false; }
	inline bool isMeshNode() const { return testFlag(ATOM_IS_MESHNODE); }
	inline void setVisitFlag() { setFlag(ATOM_VISITED); }
	inline void clearVisitFlag() { clearFlag(ATOM_VISITED); }
	inline bool wasVisited() const { return testFlag(ATOM_VISITED); }
};

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

	inline bool neighborBond(int neighborIndex1, int neighborIndex2) const {
		DISLOCATIONS_ASSERT(neighborIndex1 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex2 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex1 >= 0 && neighborIndex1 < numNeighbors);
		DISLOCATIONS_ASSERT(neighborIndex2 >= 0 && neighborIndex2 < numNeighbors);
		return (neighborArray[neighborIndex1] & (1<<neighborIndex2));
	}

	void setNeighborBond(int neighborIndex1, int neighborIndex2, bool bonded) {
		DISLOCATIONS_ASSERT(neighborIndex1 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex2 <= MAX_CRYSTALLINE_ATOM_NEIGHBORS);
		DISLOCATIONS_ASSERT(neighborIndex1 >= 0 && neighborIndex1 < numNeighbors);
		DISLOCATIONS_ASSERT(neighborIndex2 >= 0 && neighborIndex2 < numNeighbors);
		if(bonded) {
			neighborArray[neighborIndex1] |= (1<<neighborIndex2);
			neighborArray[neighborIndex2] |= (1<<neighborIndex1);
		}
		else {
			neighborArray[neighborIndex1] &= ~(1<<neighborIndex2);
			neighborArray[neighborIndex2] &= ~(1<<neighborIndex1);
		}
	}

	inline bool isFCC() const { return cnaType == FCC; }
	inline bool isNonFCC() const { return cnaType != FCC; }
	inline bool isHCP() const { return cnaType == HCP; }
	inline bool isNonHCP() const { return cnaType != HCP; }
	inline bool isBCC() const { return cnaType == BCC; }
	inline bool isNonBCC() const { return cnaType != BCC; }

	void setCNAType(CNAAtomType type) {
		cnaType = type;
		if(isFCC() || isHCP() || isBCC())
			setFlag(ATOM_IS_CRYSTALLINE);
		else
			clearFlag(ATOM_IS_CRYSTALLINE);
	}

	inline const CrystalLatticeType& latticeType() const {
		return latticeTypeFromCNA(cnaType);
	}

	LatticeVector latticeNeighborVector(int neighborIndex) const {
		const CrystalLatticeType& lattice = latticeType();
		DISLOCATIONS_ASSERT(neighborIndex >= 0 && neighborIndex < lattice.numNeighbors);
		return latticeOrientation * lattice.neighborVectors[neighborIndex];
	}

	inline bool isLocalAtom() const { return testFlag(ATOM_IS_LOCAL_ATOM); }
	inline bool isNonLocalAtom() const { return !testFlag(ATOM_IS_LOCAL_ATOM); }

	bool isValidTransitionNeighbor(int neighborIndex) const {
		switch(cnaType) {
		case FCC:
		case HCP:
			return true;
		case BCC:
			return neighborIndex < 8;
		default:
			return false;
		}
	}

	LatticeOrientation determineTransitionMatrix(int neighborIndex) const {
		switch(cnaType) {
		case FCC:
		case HCP:
			return determineTransitionMatrixFCCHCP(neighborIndex);
		case BCC:
			return determineTransitionMatrixBCC(neighborIndex);
		default:
			DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "determineTransitionMatrix()", "Called for a non-crystalline atom.");		// This is not a crystalline atom.
			return IDENTITY;
		}
	}

	LatticeOrientation determineTransitionMatrixFCCHCP(int neighborIndex) const;
	LatticeOrientation determineTransitionMatrixBCC(int neighborIndex) const;

};

#endif


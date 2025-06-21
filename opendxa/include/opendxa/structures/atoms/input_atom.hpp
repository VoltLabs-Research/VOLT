#ifndef OPENDXA_STRUCTURES_ATOMS_INPUT_ATOM_HPP
#define OPENDXA_STRUCTURES_ATOMS_INPUT_ATOM_HPP

#include <opendxa/structures/atoms/base_atom.hpp>
#include <opendxa/structures/structures.hpp>

struct Cluster;
struct CrystalLatticeType;
enum CNAAtomType;

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

    InputAtom();
    explicit InputAtom(const BaseAtom& other);
    ~InputAtom() override = default;

    InputAtom* neighborAtom(int index) const {
        return reinterpret_cast<InputAtom*>(neighbor(index));
    }

    bool neighborBond(int neighborIndex1, int neighborIndex2) const;
    void setNeighborBond(int neighborIndex1, int neighborIndex2, bool bonded);

    bool isFCC() const {
        return cnaType == FCC;
    }

    bool isNonFCC() const {
        return cnaType != FCC;
    }

    bool isHCP() const {
        return cnaType == HCP;
    }

    bool isNonHCP() const {
        return cnaType != HCP;
    }

    bool isBCC() const {
        return cnaType == BCC;
    }

    bool isNonBCC() const {
        return cnaType != BCC;
    }

    bool isLocalAtom() const {
        return testFlag(ATOM_IS_LOCAL_ATOM);
    }

    bool isNonLocalAtom() const {
        return !testFlag(ATOM_IS_LOCAL_ATOM);
    }

    void setCNAType(CNAAtomType type);
    const CrystalLatticeType& latticeType() const;
    Vector3 latticeNeighborVector(int neighborIndex) const;
    bool isValidTransitionNeighbor(int neighborIndex) const;
    LatticeOrientation determineTransitionMatrix(int neighborIndex) const;

    LatticeOrientation determineTransitionMatrixFCCHCP(int neighborIndex) const;
    LatticeOrientation determineTransitionMatrixBCC(int neighborIndex) const;

	void initializeNeighborArray();
    void validateBonds() const;
    bool isValidBondIndices(int idx1, int idx2) const;
};

#endif 
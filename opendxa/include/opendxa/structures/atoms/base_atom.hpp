#ifndef OPENDXA_STRUCTURES_ATOMS_BASE_ATOM_HPP
#define OPENDXA_STRUCTURES_ATOMS_BASE_ATOM_HPP

#include <opendxa/includes.hpp>
#include <opendxa/settings.hpp>

struct BaseAtom;

enum AtomBitFlags{
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
    ATOM_TB = 10
};

union BaseAtomNeighbor{
    BaseAtom* pointer;
    int tag;
};

struct BaseAtom{
    int tag;
    Point3 pos;
    int numNeighbors;
    BaseAtomNeighbor neighbors[MAX_ATOM_NEIGHBORS];
    unsigned int flags;

    // Constructor y destructor
    BaseAtom();
    virtual ~BaseAtom() = default;

    BaseAtom* neighbor(int index) const;
    void setNeighbor(int index, BaseAtom* atom);
    
    bool hasNeighbor(const BaseAtom* other) const;
    bool hasNeighborTag(int neighborTag) const;
    int neighborIndex(const BaseAtom* neighbor) const;
    int neighborIndexTag(int neighborTag) const;
    void addNeighbor(BaseAtom* neighbor);

    bool testFlag(AtomBitFlags which) const {
        return (flags & (1 << which));
    }

    void setFlag(AtomBitFlags which) {
        flags |= (1 << which);
    }

    void clearFlag(AtomBitFlags which) {
        flags &= ~(1 << which);
    }

    bool isCrystalline() const {
        return testFlag(ATOM_IS_CRYSTALLINE); 
    }

    bool isDisordered() const {
        return !testFlag(ATOM_IS_CRYSTALLINE);
    }

    bool isMeshNode() const {
        return testFlag(ATOM_IS_MESHNODE);
    }

    void setVisitFlag() {
        setFlag(ATOM_VISITED);
    }

    void clearVisitFlag() {
        clearFlag(ATOM_VISITED);
    }
    
    bool wasVisited() const {
        return testFlag(ATOM_VISITED);
    }

    void clearNeighbors();
    bool isValidNeighborIndex(int index) const;
    void removeNeighbor(const BaseAtom* neighbor);
    void validateNeighbors() const;
};

#endif 
#ifndef OPENDXA_BASE_ATOMS_HPP
#define OPENDXA_BASE_ATOMS_HPP

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

    inline BaseAtom* neighbor(int index) const{
        DISLOCATIONS_ASSERT_GLOBAL(index < numNeighbors);
        return neighbors[index].pointer;
    }

    inline void setNeighbor(int index, BaseAtom* atom){
        DISLOCATIONS_ASSERT_GLOBAL(index < numNeighbors);
        neighbors[index].pointer = atom;
    }

    inline bool hasNeighbor(const BaseAtom* other) const{
        // TODO: Seriously? Implement a better search algo.
        for(int i = 0; i < numNeighbors; i++){
            if(neighbors[i].pointer == other) return true;
        }
        return false;
    }

    inline bool hasNeighborTag(int neighborTag) const{
        // TODO: better match algo.
        for(int i = 0; i < numNeighbors; i++){
            if(neighbors[i].pointer && neighbors[i].pointer->tag == neighborTag){
                return true;
            }
        }
        return false;
    }

    inline int neighborIndex(const BaseAtom* neighbor) const{
        for(int ni = 0; ni < numNeighbors; ni++){
            if(neighbors[ni].pointer == neighbor){
                return ni;
            }
        }
        DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndex()", "The given atom is not in the neighbor list.");
        return -1;
    }

    inline int neighborIndexTag(int neighborTag) const{
		for(int ni = 0; ni < numNeighbors; ni++){
			if(neighbors[ni].pointer && neighbors[ni].pointer->tag == neighborTag){
				return ni;
            }
		}
		DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndexTag()", "The given atom is not in the neighbor list.");
		return -1;
	}

	inline void addNeighbor(BaseAtom* neighbor) {
		if(hasNeighbor(neighbor)){
			cout << "Atom " << tag << " has already a neighbor: " << neighbor->tag;
		}
		DISLOCATIONS_ASSERT_GLOBAL(hasNeighbor(neighbor) == false);
		DISLOCATIONS_ASSERT_MSG_GLOBAL(numNeighbors < MAX_ATOM_NEIGHBORS, "addNeighbor()", "Maximum number of nearest neighbors per atom was exceeded.");
		neighbors[numNeighbors++].pointer = neighbor;
	}

	inline bool testFlag(AtomBitFlags which) const {
        return (flags & (1 << which));
    }

	inline void setFlag(AtomBitFlags which){
        flags |= (1 << which);
    }

	inline void clearFlag(AtomBitFlags which){
        flags &= ~(1 << which);
    }

	inline bool isCrystalline() const{
        return testFlag(ATOM_IS_CRYSTALLINE); 
    }

	inline bool isDisordered() const{
        return testFlag(ATOM_IS_CRYSTALLINE) == false;
    }

	inline bool isMeshNode() const{
        return testFlag(ATOM_IS_MESHNODE);
    }

	inline void setVisitFlag(){
        setFlag(ATOM_VISITED);
    }

	inline void clearVisitFlag(){
        clearFlag(ATOM_VISITED);
    }
    
	inline bool wasVisited() const{
        return testFlag(ATOM_VISITED);
    }
};

#endif
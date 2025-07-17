#pragma once

#include <cstring>
#include <cassert>
#include <opendxa/structures/crystal_structure_types.h>

namespace OpenDXA{

struct NeighborBondArray{
    unsigned int neighborArray[32];

    NeighborBondArray(){
        memset(neighborArray, 0, sizeof(neighborArray));
    }

    inline void setNeighborBond(int neighborIndex1, int neighborIndex2, bool bonded){
        //assert(neighborIndex1 < 32);
        //assert(neighborIndex2 < 32);
        const unsigned int bit1 = 1u << neighborIndex2;
        const unsigned int bit2 = 1u << neighborIndex1;
        if(bonded){
            neighborArray[neighborIndex1] |= bit1;
            neighborArray[neighborIndex2] |= bit2;
        }else{
            neighborArray[neighborIndex1] &= ~bit1;
            neighborArray[neighborIndex2] &= ~bit2;
        }
    }

    inline bool neighborBond(int neighborIndex1, int neighborIndex2) const{
        //assert(neighborIndex1 < 32);
        //assert(neighborIndex2 < 32);
        return (neighborArray[neighborIndex1] & (1u << neighborIndex2)) != 0;
    }

    inline bool neighborBond(int neighborIndex1, int neighborIndex2){
        return (neighborArray[neighborIndex1] & (1u << neighborIndex2)) != 0;
    }
};

}

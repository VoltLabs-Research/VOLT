#pragma once

#include <vector>
#include <opendxa/math/lin_alg.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>

namespace OpenDXA{

// Fast sorting function for an array of (bounded) integers.
// Sorts values in descending order.
// TODO: move to utilities/
template<typename iterator>
void bitmapSort(iterator begin, iterator end, int max){
	assert(max <= 32);
	assert(end >= begin);
	int bitarray = 0;
	for(iterator pin = begin; pin != end; ++pin){
		assert(*pin >= 0 && *pin < max);
		bitarray |= 1 << (*pin);
	}

	iterator pout = begin;
	for(int i = max - 1; i >= 0; i--){
		if(bitarray & (1 << i)){
			*pout++ = i;
		}
	}
	assert(pout == end);
}

struct CoordinationStructure{
    int numNeighbors;
    std::vector<Vector3> latticeVectors;
    NeighborBondArray neighborArray;
    int cnaSignatures[MAX_NEIGHBORS];
    int commonNeighbors[MAX_NEIGHBORS][2];
};

}

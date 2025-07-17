#pragma once

#include <vector>
#include <opendxa/math/lin_alg.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>

namespace OpenDXA{

// A tiny, high perfomance integer sort for very small arrays of nonnegative values.
// Given a range [begin, end) of integers each in [0, max), this routines builds
// a 32-bit bitmask by setting the bit at position v whenever v appears in the input.
// It then writes ot the set bits in descending order, compacting them back into the same
// array. This is far faster than a general-purpose sort when the value range is known and small,
// such as neighbor indices in coordination analysis.
template<typename iterator>
void bitmapSort(iterator begin, iterator end, int max){
	// We rely on a 32-bit integer, to hold up to 32 distinct values
	//assert(max <= 32);
	//assert(end >= begin);

	// Build a bitmask, bitarray's bit v is self if v appeared in the input
	int bitarray = 0;
	for(iterator pin = begin; pin != end; ++pin){
		//assert(*pin >= 0 && *pin < max);
		bitarray |= 1 << (*pin);
	}

	// Overwrite the original range by pulling out bits from high to low
	iterator pout = begin;
	for(int i = max - 1; i >= 0; i--){
		if(bitarray & (1 << i)){
			*pout++ = i;
		}
	}

	// After writing exactly as many values as we read, the output pointer
	// should reach the end of the original range
	//assert(pout == end);
}

// Represented the fixed connectivity pattern around one atom type in the crystal.
// numNeighbors gives how many nearest neighbors to consider (for example, 12 in FCC).
// latticeVectors holds the ideal directions to those neighbors in a perfect lattice.
// neighborArray is a precomputed bitmask table indicating which neighbor pairs
// share a bond between them.
// cnaSignatures[i] holds a small integer code describing the local ring-pattern
// (e.g. 4-2-1 vs 4-2-2) for neighbor i, used in common-neighbor analysis.
// commonNeighbors[i][0 ... 1] can store up to two neighbor indices that
// are shared between this atom and neighbor i, helping to accelerate
// some toplogy checks without recomputing bitmasks.
struct CoordinationStructure{
    int numNeighbors;
    std::vector<Vector3> latticeVectors;
    NeighborBondArray neighborArray;
    int cnaSignatures[MAX_NEIGHBORS];
    int commonNeighbors[MAX_NEIGHBORS][2];
};

}

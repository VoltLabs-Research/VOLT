#pragma once

#include <vector>
#include <opendxa/math/lin_alg.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>

namespace OpenDXA{

struct CoordinationStructure{
    int numNeighbors;
    std::vector<Vector3> latticeVectors;
    NeighborBondArray neighborArray;
    int cnaSignatures[MAX_NEIGHBORS];
    int commonNeighbors[MAX_NEIGHBORS][2];
};

}

#pragma once

#include <vector>
#include <array>
#include <opendxa/math/lin_alg.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/coordination_structure.h>

namespace OpenDXA {

struct SymmetryPermutation{
    Matrix3 transformation;
    std::array<int, MAX_NEIGHBORS> permutation;
    std::vector<int> product;
    std::vector<int> inverseProduct;
};

struct LatticeStructure{
    const CoordinationStructure* coordStructure;
    std::vector<Vector3> latticeVectors;
    Matrix3 primitiveCell;
    Matrix3 primitiveCellInverse;
    int maxNeighbors;
    std::vector<SymmetryPermutation> permutations;
};

}

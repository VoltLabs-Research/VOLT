#include <opendxa_py/functions/cutoff.hpp>

#include <opendxa/utils/cutoff_estimator.hpp>
#include <opendxa/includes.hpp>

namespace OpenDXA::Bindings::Python::Wrappers{
 
double estimateCutoffFromPositions(
        const std::vector<std::array<double, 3>>& positions,
        const std::array<std::array<double, 3>, 3>& cell){
    std::vector<InputAtom> atoms;
    atoms.reserve(positions.size());

    for(size_t i = 0; i < positions.size(); ++i){
        InputAtom atom;
        atom.pos = Point3(positions[i][0], positions[i][1], positions[i][2]);
        atom.tag = static_cast<int>(i);
        atoms.push_back(atom);
    }

    Matrix3 cellMatrix;
    for(int i = 0; i < 3; ++i){
        for(int j = 0; j < 3; ++j){
            cellMatrix(i, j) = cell[i][j];
        }
    }

    return estimateCutoff(atoms, cellMatrix);
}

}
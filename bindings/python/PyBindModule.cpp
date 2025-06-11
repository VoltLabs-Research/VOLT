#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>
#include "Includes.hpp"
#include "core/StackingFaults.hpp"
#include "utils/CutoffEstimator.hpp"

namespace py = pybind11;

double estimateCutoffWrapper(
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

PYBIND11_MODULE(opendxa, module){
    module.doc() = "OpenDXA Python Bindings for Dislocation Analysis";

    module.def(
        "estimate_cutoff", 
        &estimateCutoffWrapper,
        "Estimate optimal CNA cutoff from atomic positions",
        py::arg("positions"),
        py::arg("cell"));
    
    module.attr("FCC") = py::int_(static_cast<int>(FCC));
    module.attr("HCP") = py::int_(static_cast<int>(HCP));
    module.attr("BCC") = py::int_(static_cast<int>(BCC));
    module.attr("OTHER") = py::int_(static_cast<int>(UNDEFINED));
}

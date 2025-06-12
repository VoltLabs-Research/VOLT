#include <opendxa_py/bindings/cutoff.hpp>
#include <opendxa_py/functions/cutoff.hpp>

namespace py = pybind11;

namespace OpenDXA::Bindings::Python{

void bindEstimateCutoffFromPositions(py::module &m){
    m.def(
        "estimate_cutoff", 
        &Wrappers::estimateCutoffFromPositions,
        "Estimate optimal CNA cutoff from atomic positions",
        py::arg("positions"),
        py::arg("cell"));
}

}
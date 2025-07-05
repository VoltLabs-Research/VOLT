#include <opendxa_py/bindings/module.hpp>
#include <opendxa_py/bindings/dislocation_analysis.hpp>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>

namespace OpenDXA::Bindings::Python{

void bindAllModules(pybind11::module &m){
    bindDislocationAnalysis(m);
}

}
#include <opendxa_py/bindings/module.hpp>
#include <opendxa_py/bindings/analysis.hpp>
#include <opendxa_py/bindings/cutoff.hpp>
#include <opendxa_py/bindings/logger.hpp>

namespace OpenDXA::Bindings::Python{

void bindAllModules(pybind11::module &m){
    bindDislocationAnalysis(m);
    bindEstimateCutoffFromPositions(m);
    bindLogger(m);
}

}
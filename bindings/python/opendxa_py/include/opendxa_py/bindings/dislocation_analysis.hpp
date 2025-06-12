#ifndef OPENDXA_PYTHON_DISLOCATION_ANALYSIS_BINDINGS_HPP
#define OPENDXA_PYTHON_DISLOCATION_ANALYSIS_BINDINGS_HPP

#include <pybind11/pybind11.h>

namespace OpenDXA::Bindings::Python{

void bindDislocationAnalysis(pybind11::module &m);

}

#endif
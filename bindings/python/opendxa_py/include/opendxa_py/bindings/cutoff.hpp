#ifndef OPENDXA_PYTHON_CUTOFF_BINDINGS_HPP
#define OPENDXA_PYTHON_CUTOFF_BINDINGS_HPP

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>

namespace OpenDXA::Bindings::Python{

void bindEstimateCutoffFromPositions(pybind11::module &m);

}

#endif
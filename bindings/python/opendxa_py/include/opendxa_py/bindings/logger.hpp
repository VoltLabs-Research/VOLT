#ifndef OPENDXA_PYTHON_LOGGER_BINDINGS_HPP
#define OPENDXA_PYTHON_LOGGER_BINDINGS_HPP

#include <pybind11/pybind11.h>

namespace OpenDXA::Bindings::Python{

void bindLogger(pybind11::module &m);

}

#endif
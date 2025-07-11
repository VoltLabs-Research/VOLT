#ifndef OPENDXA_PY_BINDINGS_MODULE_HPP
#define OPENDXA_PY_BINDINGS_MODULE_HPP

#include <pybind11/pybind11.h>

namespace OpenDXA::Bindings::Python{
    void bindAllModules(pybind11::module& m);
    void bindLogging(pybind11::module &m);
}

#endif
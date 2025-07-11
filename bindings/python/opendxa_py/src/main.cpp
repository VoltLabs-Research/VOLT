#include <pybind11/pybind11.h>
#include <opendxa_py/bindings/module.hpp>
#include <opendxa_py/bindings/python_sink.hpp>

namespace py = pybind11;

PYBIND11_MODULE(_core, module){
    module.doc() = "OpenDXA Python Bindings for Dislocation Analysis";

    OpenDXA::Bindings::Python::bindAllModules(module);
    OpenDXA::Bindings::Python::bindLogging(module);
}
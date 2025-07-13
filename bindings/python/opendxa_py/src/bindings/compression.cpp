#include <pybind11/pybind11.h>
#include <opendxa_py/bindings/compression.hpp>
#include <opendxa/utilities/compress_dump_zstd.h>

namespace py = pybind11;

namespace OpenDXA::Bindings::Python{

void bindCompression(py::module_ &m){
    m.def("compress_dump_to_zstd", &OpenDXA::compressDumpToZstd,
        py::arg("dump_file"), py::arg("output_file"));
}

}
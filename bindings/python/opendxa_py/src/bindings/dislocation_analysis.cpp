#include <opendxa_py/bindings/dislocation_analysis.hpp>
#include <opendxa_py/wrappers/dislocation_analysis.hpp>

namespace py = pybind11;
using namespace pybind11::literals;

namespace OpenDXA::Bindings::Python{

void bindDislocationAnalysis(py::module &m){
    py::class_<Wrappers::AnalysisWrapper>(
        m, "DislocationAnalysis", "High-level dislocation analysis interface")
        .def(py::init<>(), "Create a new dislocation analyzer")
        .def("reset_config", &Wrappers::AnalysisWrapper::resetConfig, 
             "Reset all configuration parameters to defaults")
        .def("set_cutoff", &Wrappers::AnalysisWrapper::setCutoff, 
             "Set CNA cutoff radius", py::arg("cutoff"))
        .def("set_pbc", &Wrappers::AnalysisWrapper::setPBC,
             "Set periodic boundary conditions",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_atom_offset", &Wrappers::AnalysisWrapper::setAtomOffset,
             "Set atom coordinate offset",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_scale_factors", &Wrappers::AnalysisWrapper::setScaleFactors,
             "Set cell scaling factors",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_circuit_sizes", &Wrappers::AnalysisWrapper::setCircuitSizes,
             "Set Burgers circuit parameters",
             py::arg("max_circuit"), py::arg("extended_circuit"))
        .def("set_smoothing_params", &Wrappers::AnalysisWrapper::setSmoothingParams,
             "Set smoothing and coarsening parameters",
             py::arg("surface_smooth"), py::arg("line_smooth"), py::arg("line_coarsen"))
        .def("set_sf_flatten", &Wrappers::AnalysisWrapper::setSFFlatten,
             "Set stacking fault flattening level", py::arg("flatten"))
        .def("set_output_files", &Wrappers::AnalysisWrapper::setOutputFiles,
             "Set output file paths",
             py::arg("main_output") = "",
             py::arg("mesh_file") = "",
             py::arg("atoms_file") = "",
             py::arg("sf_planes_file") = "",
             py::arg("surface_file") = "",
             py::arg("surface_cap_file") = "",
             py::arg("cell_file") = "")
        .def("compute", &Wrappers::AnalysisWrapper::compute,
             "Run analysis from input file",
             py::arg("input_file"), py::arg("output_file") = "")
        .def("get_config", &Wrappers::AnalysisWrapper::getConfig,
             "Get current configuration as dictionary");
}

}
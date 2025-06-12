#include <opendxa_py/bindings/analysis.hpp>
#include <opendxa_py/wrappers/dislocation_analysis.hpp>

namespace py = pybind11;
using namespace pybind11::literals;

namespace OpenDXA::Bindings::Python{

void bindDislocationAnalysis(py::module &m){
    py::class_<Wrappers::AnalysisWrapper>(
        m, "DislocationAnalysis", "High-level dislocation analysis interface")
        .def(py::init<>(), "Create a new dislocation analyzer")
        .def("reset_config", &wrappers::AnalysisWrapper::resetConfig, 
             "Reset all configuration parameters to defaults")
        .def("set_cutoff", &wrappers::AnalysisWrapper::setCutoff, 
             "Set CNA cutoff radius", py::arg("cutoff"))
        .def("set_pbc", &wrappers::AnalysisWrapper::setPBC,
             "Set periodic boundary conditions",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_atom_offset", &wrappers::AnalysisWrapper::setAtomOffset,
             "Set atom coordinate offset",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_scale_factors", &wrappers::AnalysisWrapper::setScaleFactors,
             "Set cell scaling factors",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_circuit_sizes", &wrappers::AnalysisWrapper::setCircuitSizes,
             "Set Burgers circuit parameters",
             py::arg("max_circuit"), py::arg("extended_circuit"))
        .def("set_smoothing_params", &wrappers::AnalysisWrapper::setSmoothingParams,
             "Set smoothing and coarsening parameters",
             py::arg("surface_smooth"), py::arg("line_smooth"), py::arg("line_coarsen"))
        .def("set_sf_flatten", &wrappers::AnalysisWrapper::setSFFlatten,
             "Set stacking fault flattening level", py::arg("flatten"))
        .def("set_output_files", &wrappers::AnalysisWrapper::setOutputFiles,
             "Set output file paths",
             py::arg("main_output") = "",
             py::arg("mesh_file") = "",
             py::arg("atoms_file") = "",
             py::arg("sf_planes_file") = "",
             py::arg("surface_file") = "",
             py::arg("surface_cap_file") = "",
             py::arg("cell_file") = "")
        .def("compute", &DislocationAnalysis::compute,
             "Run analysis from input file",
             py::arg("input_file"), py::arg("output_file") = "")
        .def("get_config", &DislocationAnalysis::getConfig,
             "Get current configuration as dictionary");
}

}
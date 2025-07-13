#include <opendxa_py/bindings/dislocation_analysis.hpp>
#include <opendxa_py/wrappers/dislocation_analysis.hpp>
#include <opendxa/structures/crystal_structure_types.h>
#include <pybind11/stl.h>

namespace py = pybind11;
using namespace pybind11::literals;

namespace OpenDXA::Bindings::Python{

void bindDislocationAnalysis(py::module &m){
    // Bind crystal structure enum
    py::enum_<LatticeStructureType>(m, "LatticeStructure", "Crystal lattice structure types")
        .value("FCC", LATTICE_FCC, "Face-centered cubic")
        .value("BCC", LATTICE_BCC, "Body-centered cubic")
        .value("HCP", LATTICE_HCP, "Hexagonal close-packed")
        .value("CUBIC_DIAMOND", LATTICE_CUBIC_DIAMOND, "Cubic diamond")
        .value("HEX_DIAMOND", LATTICE_HEX_DIAMOND, "Hexagonal diamond")
        .export_values();

     py::enum_<StructureAnalysis::Mode>(m, "StructureIdentification", "Chose the per-atom classification mode: PTM or CNA")
          .value("PTM", StructureAnalysis::Mode::PTM, "Polyhedral Template Matching")
          .value("CNA", StructureAnalysis::Mode::CNA, "Common Neighbor Analysis")
          .export_values();
     py::class_<ProgressInfo>(m, "ProgressInfo", "Information about the analysis progress")
        .def_readonly("completed_frames", &ProgressInfo::completedFrames, "Number of frames processed so far")
        .def_readonly("total_frames", &ProgressInfo::totalFrames, "Total number of frames to process")
        .def_readonly("frame_result", &ProgressInfo::frameResult, "The JSON result of the frame that just completed");
    // Bind the main analysis wrapper class
    py::class_<Wrappers::AnalysisWrapper>(m, "DislocationAnalysis", 
        "High-level interface for dislocation analysis using the DXA algorithm")
        .def(py::init<>(), "Create a new dislocation analyzer")
        
        // Configuration methods
        .def("reset_config", &Wrappers::AnalysisWrapper::resetConfig,
             "Reset the analyzer to default configuration")
        
        .def("set_crystal_structure", &Wrappers::AnalysisWrapper::setInputCrystalStructure,
             "Set the input crystal structure type",
             py::arg("structure"))
        
        .def("set_max_trial_circuit_size", &Wrappers::AnalysisWrapper::setMaxTrialCircuitSize,
             "Set the maximum trial circuit size for Burgers circuit analysis",
             py::arg("size"))
        
        .def("set_circuit_stretchability", &Wrappers::AnalysisWrapper::setCircuitStretchability,
             "Set the circuit stretchability parameter",
             py::arg("stretch"))
        
        .def("set_mark_core_atoms", &Wrappers::AnalysisWrapper::setMarkCoreAtoms, "",
             py::arg("mark"))
                
        .def("set_line_smoothing_level", &Wrappers::AnalysisWrapper::setLineSmoothingLevel, "",
             py::arg("level"))
                
        .def("set_line_point_interval", &Wrappers::AnalysisWrapper::setLinePointInterval, "",
             py::arg("interval"))
                
        .def("set_defect_mesh_smoothing_level", &Wrappers::AnalysisWrapper::setDefectMeshSmoothingLevel, "",
             py::arg("level"))
                
        .def("set_identification_mode", &Wrappers::AnalysisWrapper::setIdentificationMode, "",
             py::arg("mode"))
        
        .def("set_only_perfect_dislocations", &Wrappers::AnalysisWrapper::setOnlyPerfectDislocations,
             "Set whether to analyze only perfect dislocations",
             py::arg("flag"))
     .def("set_progress_callback", 
            [](Wrappers::AnalysisWrapper &self, py::function callback) {
                auto cpp_callback = [callback](const ProgressInfo& info) {
                    py::gil_scoped_acquire gil;
                    callback(info);
                };
                self.setProgressCallback(cpp_callback);
            },
            "Set a callback function to be called on each processed frame.\n"
            "The function should accept one argument: a ProgressInfo object.",
            py::arg("callback"))

        // Main computation method
        .def("compute", &Wrappers::AnalysisWrapper::compute,
             "Run dislocation analysis on the input file",
             py::arg("input_file"), 
             py::arg("output_file") = "")
        
          .def("compute_trajectory", &Wrappers::AnalysisWrapper::computeTrajectory,
             "Run dislocation analysis on a list of input files in parallel",
             py::arg("input_files"),
             py::arg("output_file_template"))
             
        .def("get_config", &Wrappers::AnalysisWrapper::getConfig,
             "Get current analyzer configuration as a dictionary");
}

}
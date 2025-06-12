#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <pybind11/numpy.h>
#include <opendxa/includes.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/utils/cutoff_estimator.hpp>
#include <opendxa/engine/config.hpp>
#include <sstream>

namespace py = pybind11;
using namespace pybind11::literals;

double estimateCutoffWrapper(
        const std::vector<std::array<double, 3>>& positions,
        const std::array<std::array<double, 3>, 3>& cell){
    std::vector<InputAtom> atoms;
    atoms.reserve(positions.size());

    for(size_t i = 0; i < positions.size(); ++i){
        InputAtom atom;
        atom.pos = Point3(positions[i][0], positions[i][1], positions[i][2]);
        atom.tag = static_cast<int>(i);
        atoms.push_back(atom);
    }

    Matrix3 cellMatrix;
    for(int i = 0; i < 3; ++i){
        for(int j = 0; j < 3; ++j){
            cellMatrix(i, j) = cell[i][j];
        }
    }

    return estimateCutoff(atoms, cellMatrix);
}

// High-level dislocation analysis class for Python
class DislocationAnalysis{
public:
    DislocationAnalysis(){
        msgStream = std::make_unique<std::ostringstream>();
        verboseStream = std::make_unique<std::ostringstream>();
        analyzer = std::make_unique<DXAStackingFaults>(*msgStream, *verboseStream);
        
        resetConfig();
    }

    ~DislocationAnalysis() = default;

    void resetConfig(){
        config = OpenDXA::Config{};
        // Will be auto-estimated if 0
        config.cnaCutoff = 0.0;
    }

    void setCutoff(double cutoff){
        if(cutoff <= 0){
            throw std::invalid_argument("Cutoff must be positive");
        }
        config.cnaCutoff = cutoff;
    }

    void setPBC(bool x, bool y, bool z){
        config.pbcX = x;
        config.pbcY = y;
        config.pbcZ = z;
    }

    void setAtomOffset(double x, double y, double z){
        config.atomOffset = Vector3(x, y, z);
    }

    void setScaleFactors(double x, double y, double z){
        config.scaleFactors = Vector3(x, y, z);
    }

    void setCircuitSizes(int maxCircuit, int extendedCircuit){
        if(maxCircuit < 3 || maxCircuit > 50){
            throw std::invalid_argument("Max circuit size must be between 3 and 50");
        }

        if(extendedCircuit < maxCircuit){
            throw std::invalid_argument("Extended circuit size must be >= max circuit size");
        }

        config.maxCircuitSize = maxCircuit;
        config.extendedCircuitSize = extendedCircuit;
    }

    void setSmoothingParams(int surfaceSmooth, int lineSmooth, int lineCoarsen){
        if(surfaceSmooth < 0 || lineSmooth < 0 || lineCoarsen < 0){
            throw std::invalid_argument("Smoothing parameters must be non-negative");
        }

        config.surfaceSmooth = surfaceSmooth;
        config.lineSmooth = lineSmooth;
        config.lineCoarsen = lineCoarsen;
    }

    void setSFFlatten(double flatten){
        if(flatten < 0.0 || flatten > 1.0){
            throw std::invalid_argument("SF flatten level must be between 0.0 and 1.0");
        }
        config.sfFlatten = static_cast<FloatType>(flatten);
    }

    void setOutputFiles(const std::string& mainOutput = "",
            const std::string& meshFile = "",
            const std::string& atomsFile = "",
            const std::string& sfPlanesFile = "",
            const std::string& surfaceFile = "",
            const std::string& surfaceCapFile = "",
            const std::string& cellFile = ""){
        if(!mainOutput.empty()) config.outputFile = mainOutput;
        if(!meshFile.empty()) config.dumpMeshFile = meshFile;
        if(!atomsFile.empty()) config.dumpAtomsFile = atomsFile;
        if(!sfPlanesFile.empty()) config.dumpSFPlanesFile = sfPlanesFile;
        if(!surfaceFile.empty()) config.dumpSurfaceFile = surfaceFile;
        if(!surfaceCapFile.empty()) config.dumpSurfaceCapFile = surfaceCapFile;
        if(!cellFile.empty()) config.dumpCellFile = cellFile;
    }

    // Compute dislocation analysis from file
    py::dict compute(const std::string &inputFile, const std::string &outputFile = ""){
        config.inputFile = inputFile;
        if(!outputFile.empty()){
            config.outputFile = outputFile;
        }

        msgStream->str("");
        msgStream->clear();
        verboseStream->str("");
        verboseStream->clear();

        try{
            analyzer->compute(config);
            return py::dict("success"_a=true,
                "message"_a="Analysis completed successfully",
                "output_file"_a=config.outputFile,
                "log"_a=msgStream->str(),
                "verbose_log"_a=verboseStream->str());
        }catch(const std::exception &e){
            return py::dict("success"_a=false,
                "error"_a=e.what(),
                "log"_a=msgStream->str(),
                "verbose_log"_a=verboseStream->str());
        }
    }

    // Get current configuration as dict
    py::dict getConfig() const{
        return py::dict(
            "cna_cutoff"_a=config.cnaCutoff,
            "pbc"_a=py::make_tuple(config.pbcX, config.pbcY, config.pbcZ),
            "atom_offset"_a=py::make_tuple(config.atomOffset.X, config.atomOffset.Y, config.atomOffset.Z),
            "scale_factors"_a=py::make_tuple(config.scaleFactors.X, config.scaleFactors.Y, config.scaleFactors.Z),
            "max_circuit_size"_a=config.maxCircuitSize,
            "extended_circuit_size"_a=config.extendedCircuitSize,
            "surface_smooth"_a=config.surfaceSmooth,
            "line_smooth"_a=config.lineSmooth,
            "line_coarsen"_a=config.lineCoarsen,
            "sf_flatten"_a=config.sfFlatten
        );
    }


private:
    OpenDXA::Config config;
    std::unique_ptr<DXAStackingFaults> analyzer;
    std::unique_ptr<std::ostringstream> msgStream;
    std::unique_ptr<std::ostringstream> verboseStream;
};

PYBIND11_MODULE(_core, module){
    module.doc() = "OpenDXA Python Bindings for Dislocation Analysis";

    module.def(
        "estimate_cutoff", 
        &estimateCutoffWrapper,
        "Estimate optimal CNA cutoff from atomic positions",
        py::arg("positions"),
        py::arg("cell"));

    py::class_<DislocationAnalysis>(
        module,
        "DislocationAnalysis",
        "High-level dislocation analysis interface")
        .def(py::init<>(), "Create a new dislocation analyzer")
        .def("reset_config", &DislocationAnalysis::resetConfig, "Reset all configuration parameters to defaults")
        .def("set_cutoff", &DislocationAnalysis::setCutoff, "Set CNA cutoff radius", py::arg("cutoff"))
        .def("set_pbc", &DislocationAnalysis::setPBC,
             "Set periodic boundary conditions",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_atom_offset", &DislocationAnalysis::setAtomOffset,
             "Set atom coordinate offset",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_scale_factors", &DislocationAnalysis::setScaleFactors,
             "Set cell scaling factors",
             py::arg("x"), py::arg("y"), py::arg("z"))
        .def("set_circuit_sizes", &DislocationAnalysis::setCircuitSizes,
             "Set Burgers circuit parameters",
             py::arg("max_circuit"), py::arg("extended_circuit"))
        .def("set_smoothing_params", &DislocationAnalysis::setSmoothingParams,
             "Set smoothing and coarsening parameters",
             py::arg("surface_smooth"), py::arg("line_smooth"), py::arg("line_coarsen"))
        .def("set_sf_flatten", &DislocationAnalysis::setSFFlatten,
             "Set stacking fault flattening level", py::arg("flatten"))
        .def("set_output_files", &DislocationAnalysis::setOutputFiles,
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

    module.attr("FCC") = py::int_(static_cast<int>(FCC));
    module.attr("HCP") = py::int_(static_cast<int>(HCP));
    module.attr("BCC") = py::int_(static_cast<int>(BCC));
    module.attr("OTHER") = py::int_(static_cast<int>(UNDEFINED));
}

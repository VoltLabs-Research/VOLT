#include <opendxa_py/wrappers/dislocation_analysis.hpp>
#include <stdexcept>

using namespace pybind11::literals;

namespace OpenDXA::Bindings::Python::Wrappers{

AnalysisWrapper::AnalysisWrapper(){
    analyzer = std::make_unique<DXAStackingFaults>();
    resetConfig();
}

void AnalysisWrapper::resetConfig(){
    config = OpenDXA::Config{};
    // Will be auto-estimated if 0
    config.cnaCutoff = 0.0;
}

void AnalysisWrapper::setCutoff(double cutoff){
    validateCutoff(cutoff);
    config.cnaCutoff = cutoff;
}

void AnalysisWrapper::setPBC(bool x, bool y, bool z){
    config.pbcX = x;
    config.pbcY = y;
    config.pbcZ = z;
}

void AnalysisWrapper::setAtomOffset(double x, double y, double z){
    config.atomOffset = Vector3(x, y, z);
}

void AnalysisWrapper::setScaleFactors(double x, double y, double z){
    config.scaleFactors = Vector3(x, y, z);
}

void AnalysisWrapper::setCircuitSizes(int maxCircuit, int extendedCircuit){
    validateCircuitSizes(maxCircuit, extendedCircuit);
    config.maxCircuitSize = maxCircuit;
    config.extendedCircuitSize = extendedCircuit;
}

void AnalysisWrapper::setSmoothingParams(int surfaceSmooth, int lineSmooth, int lineCoarsen){
    validateSmoothingParams(surfaceSmooth, lineSmooth, lineCoarsen);
    config.surfaceSmooth = surfaceSmooth;
    config.lineSmooth = lineSmooth;
    config.lineCoarsen = lineCoarsen;
}

void AnalysisWrapper::setSFFlatten(double flatten){
    validateSFFlatten(flatten);
    config.sfFlatten = static_cast<FloatType>(flatten);
}

void AnalysisWrapper::setOutputFiles(
        const std::string& mainOutput,
        const std::string& meshFile,
        const std::string& atomsFile,
        const std::string& sfPlanesFile,
        const std::string& surfaceFile,
        const std::string& surfaceCapFile,
        const std::string& cellFile){
    if(!mainOutput.empty()) config.outputFile = mainOutput;
    if(!meshFile.empty()) config.dumpMeshFile = meshFile;
    if(!atomsFile.empty()) config.dumpAtomsFile = atomsFile;
    if(!sfPlanesFile.empty()) config.dumpSFPlanesFile = sfPlanesFile;
    if(!surfaceFile.empty()) config.dumpSurfaceFile = surfaceFile;
    if(!surfaceCapFile.empty()) config.dumpSurfaceCapFile = surfaceCapFile;
    if(!cellFile.empty()) config.dumpCellFile = cellFile;
}

json AnalysisWrapper::compute(const std::string& inputFile, const std::string& outputFile){
    config.inputFile = inputFile;
    if(!outputFile.empty()){
        config.outputFile = outputFile;
    }

    json data = analyzer->compute(config);
    return data;
}

py::dict AnalysisWrapper::getConfig() const{
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

void AnalysisWrapper::validateCutoff(double cutoff){
    if(cutoff <= 0){
        throw std::invalid_argument("Cutoff must be positive");
    }
}

void AnalysisWrapper::validateCircuitSizes(int maxCircuit, int extendedCircuit){
    if(maxCircuit < 3 || maxCircuit > 50){
        throw std::invalid_argument("Max circuit size must be between 3 and 50");
    }

    if(extendedCircuit < maxCircuit){
        throw std::invalid_argument("Extended circuit size must be >= max circuit size");
    }
}

void AnalysisWrapper::validateSmoothingParams(int surfaceSmooth, int lineSmooth, int lineCoarsen){
    if(surfaceSmooth < 0 || lineSmooth < 0 || lineCoarsen < 0){
        throw std::invalid_argument("Smoothing parameters must be non-negative");
    }
}

void AnalysisWrapper::validateSFFlatten(double flatten){
    if(flatten < 0.0 || flatten > 1.0){
        throw std::invalid_argument("SF flatten level must be between 0.0 and 1.0");
    }
}

}
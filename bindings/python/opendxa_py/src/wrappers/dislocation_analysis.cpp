#include <opendxa_py/wrappers/dislocation_analysis.hpp>
#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/core/lammps_parser.h>
#include <stdexcept>
#include <filesystem>

using namespace pybind11::literals;

namespace OpenDXA::Bindings::Python::Wrappers{

AnalysisWrapper::AnalysisWrapper() {
    analyzer = std::make_unique<OpenDXA::DislocationAnalysis>();
}

void AnalysisWrapper::resetConfig() {
    analyzer = std::make_unique<OpenDXA::DislocationAnalysis>();
}

void AnalysisWrapper::setInputCrystalStructure(int structure) {
    if (structure < 0 || structure > 10) { // Assuming enum range
        throw std::invalid_argument("Invalid crystal structure type");
    }
    analyzer->setInputCrystalStructure(static_cast<LatticeStructureType>(structure));
}

void AnalysisWrapper::setMaxTrialCircuitSize(int size) {
    validateCircuitSize(size);
    analyzer->setMaxTrialCircuitSize(size);
}

void AnalysisWrapper::setCircuitStretchability(int stretch) {
    validateStretchability(stretch);
    analyzer->setCircuitStretchability(stretch);
}

void AnalysisWrapper::setOnlyPerfectDislocations(bool flag) {
    analyzer->setOnlyPerfectDislocations(flag);
}

json AnalysisWrapper::compute(const std::string& inputFile, const std::string& outputFile) {
    validateInputFile(inputFile);
    
    // Parse LAMMPS file
    LammpsParser parser;
    LammpsParser::Frame frame;
    if (!parser.parseFile(inputFile, frame)) {
        throw std::runtime_error("Failed to parse input file: " + inputFile);
    }
    
    // Run the analysis
    bool success = analyzer->compute(frame, outputFile);
    if (!success) {
        throw std::runtime_error("Dislocation analysis failed");
    }
    
    // Export results to JSON
    json results = analyzer->exportResultsToJson(outputFile);
    return results;
}

py::dict AnalysisWrapper::getConfig() const {
    py::dict config;
    
    // Create a basic configuration dictionary
    // Note: DislocationAnalysis doesn't expose getters, so we'll create a simple config
    config["class"] = "DislocationAnalysis";
    config["description"] = "OpenDXA Dislocation Analysis Configuration";
    
    return config;
}

void AnalysisWrapper::validateInputFile(const std::string& filePath) const {
    if (filePath.empty()) {
        throw std::invalid_argument("Input file path cannot be empty");
    }
    
    if (!std::filesystem::exists(filePath)) {
        throw std::runtime_error("Input file does not exist: " + filePath);
    }
    
    // Check file extension
    std::filesystem::path path(filePath);
    std::string ext = path.extension().string();
    if (ext != ".dump" && ext != ".lammpstrj" && ext != ".xyz") {
        throw std::invalid_argument("Unsupported file format. Expected .dump, .lammpstrj, or .xyz");
    }
}

void AnalysisWrapper::validateCircuitSize(int size) const {
    if (size < 3 || size > 100) {
        throw std::invalid_argument("Circuit size must be between 3 and 100");
    }
}

void AnalysisWrapper::validateStretchability(int stretch) const {
    if (stretch < 0 || stretch > 50) {
        throw std::invalid_argument("Circuit stretchability must be between 0 and 50");
    }
}

}
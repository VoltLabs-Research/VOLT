#include <opendxa_py/wrappers/dislocation_analysis.hpp>
#include <opendxa/core/dislocation_analysis.h>
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
    if (structure < 0 || structure > 10) { 
        throw std::invalid_argument("Invalid crystal structure type");
    }
    analyzer->setInputCrystalStructure(static_cast<LatticeStructureType>(structure));
}

void AnalysisWrapper::setMaxTrialCircuitSize(int size) {
    validateCircuitSize(size);
    analyzer->setMaxTrialCircuitSize(size);
}

void AnalysisWrapper::setMarkCoreAtoms(bool markCoreAtoms){
    analyzer->setMarkCoreAtoms(markCoreAtoms);
}

void AnalysisWrapper::setLineSmoothingLevel(int lineSmoothingLevel){
    analyzer->setLineSmoothingLevel(lineSmoothingLevel);
}

void AnalysisWrapper::setLinePointInterval(int linePointInterval){
    analyzer->setLinePointInterval(linePointInterval);
}

void AnalysisWrapper::setDefectMeshSmoothingLevel(int defectMeshSmoothingLevel){
    analyzer->setDefectMeshSmoothingLevel(defectMeshSmoothingLevel);
}

void AnalysisWrapper::setIdentificationMode(int identificationMode){
    analyzer->setIdentificationMode(static_cast<StructureAnalysis::Mode>(identificationMode));
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
    json results = analyzer->compute(frame, outputFile);

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

json AnalysisWrapper::computeTrajectory(const std::vector<std::string>& input_files, const std::string& output_file_template) {
    if(input_files.empty()){
        throw std::invalid_argument("Input file list cannot be empty.");
    }

    if(output_file_template.find("%d") == std::string::npos && output_file_template.find("%i") == std::string::npos){
         throw std::invalid_argument("Output file template must contain a placeholder like %d or %i.");
    }

    std::cout << "Loading " << input_files.size() << " frames from disk..." << std::endl;
    std::vector<LammpsParser::Frame> frames;
    frames.reserve(input_files.size());
    LammpsParser parser;
    
    for(const auto& file_path : input_files){
        validateInputFile(file_path);
        LammpsParser::Frame frame;
        if(!parser.parseFile(file_path, frame)){
            throw std::runtime_error("Failed to parse input file: " + file_path);
        }
        frames.push_back(frame);
    }

    std::cout << "All frames loaded. Starting parallel analysis..." << std::endl;

    return analyzer->compute(frames, output_file_template);
}

void AnalysisWrapper::validateInputFile(const std::string& filePath) const {
    if (filePath.empty()) {
        throw std::invalid_argument("Input file path cannot be empty");
    }
    
    if (!std::filesystem::exists(filePath)) {
        throw std::runtime_error("Input file does not exist: " + filePath);
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
#ifndef OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP
#define OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP

#include <memory>
#include <string>
#include <opendxa/core/dislocation_analysis.h>
#include <nlohmann/json.hpp>
#include <pybind11_json/pybind11_json.hpp>
#include <opendxa/core/lammps_parser.h>
#include <stdexcept>
#include <filesystem>
#include <iostream>
#include <vector>
#include <string>

using json = nlohmann::json;

namespace py = pybind11;

namespace OpenDXA::Bindings::Python::Wrappers{

class AnalysisWrapper{
public:
    AnalysisWrapper();
    ~AnalysisWrapper() = default;

    // Configuration methods
    void resetConfig();
    void setInputCrystalStructure(int structure);
    void setMaxTrialCircuitSize(double size);
    void setCircuitStretchability(double stretch);
    void setOnlyPerfectDislocations(bool flag);
    void setMarkCoreAtoms(bool markCoreAtoms);
    void setLineSmoothingLevel(double lineSmoothingLevel);
    void setLinePointInterval(double linePointInterval);
    void setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel);
    void setIdentificationMode(int identificationMode);
    json computeTrajectory(const std::vector<std::string>& input_files, const std::string& output_file_template);

    // Main computation method
    json compute(const std::string& inputFile, const std::string& outputFile = "");
    py::dict getConfig() const;

private:
    std::unique_ptr<OpenDXA::DislocationAnalysis> analyzer;
    
    // Validation methods
    void validateInputFile(const std::string& filePath) const;
    void validateCircuitSize(int size) const;
    void validateStretchability(int stretch) const;
};

}

#endif
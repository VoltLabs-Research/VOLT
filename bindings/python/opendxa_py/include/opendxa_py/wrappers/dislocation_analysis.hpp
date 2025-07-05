#ifndef OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP
#define OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP

#include <memory>
#include <string>
#include <pybind11/pybind11.h>
#include <opendxa/core/dislocation_analysis.h>
#include <nlohmann/json.hpp>
#include <pybind11_json/pybind11_json.hpp>

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
    void setMaxTrialCircuitSize(int size);
    void setCircuitStretchability(int stretch);
    void setOnlyPerfectDislocations(bool flag);
    
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
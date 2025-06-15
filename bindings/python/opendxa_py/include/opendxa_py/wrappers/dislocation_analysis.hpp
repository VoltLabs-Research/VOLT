#ifndef OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP
#define OPENDXA_PYTHON_DISLOCATION_ANALYSIS_HPP

#include <memory>
#include <string>
#include <pybind11/pybind11.h>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/engine/config.hpp>
#include <opendxa/core/dislocation_tracing.hpp>
#include <nlohmann/json.hpp>
#include <pybind11_json/pybind11_json.hpp>

using json = nlohmann::json;

namespace py = pybind11;

namespace OpenDXA::Bindings::Python::Wrappers{

class AnalysisWrapper{
public:
    AnalysisWrapper();
    ~AnalysisWrapper() = default;

    void resetConfig();
    void setCutoff(double cutoff);
    void setPBC(bool x, bool y, bool z);
    void setAtomOffset(double x, double y, double z);
    void setScaleFactors(double x, double y, double z);
    void setCircuitSizes(int maxCircuit, int extendedCircuit);
    void setSmoothingParams(int surfaceSmooth, int lineSmooth, int lineCoarsen);
    void setSFFlatten(double flatten);
    void setOutputFiles(const std::string& mainOutput = "");
    
    json compute(const std::string& inputFile, const std::string& outputFile = "");
    py::dict getConfig() const;

private:
    void validateCutoff(double cutoff);
    void validateCircuitSizes(int maxCircuit, int extendedCircuit);
    void validateSmoothingParams(int surfaceSmooth, int lineSmooth, int lineCoarsen);
    void validateSFFlatten(double flatten);

    OpenDXA::Config config;
    std::unique_ptr<StackingFaults> analyzer;
};

}

#endif
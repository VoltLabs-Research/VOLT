#include <opendxa/analyzers/centrosymmetry.h>
#include <spdlog/spdlog.h>

namespace OpenDXA {

using namespace OpenDXA::Particles;

CentroSymmetryAnalyzer::CentroSymmetryAnalyzer()
    : _k(12),
      _mode(CentroSymmetryAnalysis::ConventionalMode) {}

void CentroSymmetryAnalyzer::setNumNeighbors(int k){
    _k = k;
}

void CentroSymmetryAnalyzer::setMode(CentroSymmetryAnalysis::CSPMode mode){
    _mode = mode;
}

std::shared_ptr<ParticleProperty> CentroSymmetryAnalyzer::createPositionProperty(const LammpsParser::Frame& frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(frame.natoms, ParticleProperty::PositionProperty, 0, true));
    if(!property || property->size() != (std::size_t)frame.natoms) return nullptr;

    Point3* data = property->dataPoint3();
    if(!data) return nullptr;

    for(std::size_t i = 0; i < frame.positions.size() && i < (std::size_t)frame.natoms; i++){
        data[i] = frame.positions[i];
    }
    return property;
}

json CentroSymmetryAnalyzer::compute(const LammpsParser::Frame& frame, const std::string& outputBase){
    auto start = std::chrono::high_resolution_clock::now();

    json result;
    if(frame.natoms <= 0){
        result["is_failed"] = true;
        result["error"] = "Invalid number of atoms";
        return result;
    }

    if(_k < 2){
        result["is_failed"] = true;
        result["error"] = "numNeighbors must be >= 2";
        return result;
    }
    if(_k > CentroSymmetryAnalysis::MAX_CSP_NEIGHBORS){
        result["is_failed"] = true;
        result["error"] = "numNeighbors too large";
        return result;
    }
    if((_k % 2) != 0){
        result["is_failed"] = true;
        result["error"] = "numNeighbors must be even";
        return result;
    }

    auto positions = createPositionProperty(frame);
    if(!positions){
        result["is_failed"] = true;
        result["error"] = "Failed to create position property";
        return result;
    }

    spdlog::info("Computing CSP: k={}, mode={}", _k, (int)_mode);

    CentroSymmetryAnalysis::Engine engine(
        positions.get(),
        frame.simulationCell,
        _k,
        _mode
    );

    engine.perform();

    auto end = std::chrono::high_resolution_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count();

    result["is_failed"] = false;
    result["num_neighbors"] = _k;
    result["mode"] = (_mode == CentroSymmetryAnalysis::ConventionalMode) ? "conventional" : "matching";
    result["duration_ms"] = ms;
    result["histogram_bins"] = engine.numHistogramBins();
    result["histogram_bin_size"] = engine.histogramBinSize();
    result["max_csp"] = engine.maxCSP();

    if(!outputBase.empty()){
        std::string path = outputBase + "_csp.msgpack";
        json payload = _jsonExporter.getCentroSymmetryData(engine, frame.ids);
        _jsonExporter.writeJsonMsgpackToFile(payload, path);
        spdlog::info("CSP written to {}", path);
        result["output"] = path;
    }

    return result;
}

}

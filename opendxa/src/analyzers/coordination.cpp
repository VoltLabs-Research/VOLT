#include <opendxa/analyzers/coordination.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

CoordinationAnalyzer::CoordinationAnalyzer()
    : _cutoff(3.2),
      _rdfBins(500){}

void CoordinationAnalyzer::setCutoff(double cutoff){
    _cutoff = cutoff;
}

void CoordinationAnalyzer::setRdfBins(int bins){
    _rdfBins = bins;
}

std::shared_ptr<ParticleProperty> CoordinationAnalyzer::createPositionProperty(const LammpsParser::Frame &frame){
    if(!frame.positions || frame.positions->size() != static_cast<size_t>(frame.natoms)){
        spdlog::error("Failed to access position property");
        return nullptr;
    }

    return frame.positions;
}

bool CoordinationAnalyzer::validateSimulationCell(const SimulationCell& cell){
    const AffineTransformation& matrix = cell.matrix();
    for(int i = 0; i < 3; i++){
        for(int j = 0; j < 3; j++){
            double value = matrix(i, j);
            if(std::isnan(value) || std::isinf(value)){
                spdlog::error("Invalid cell matrix component at ({},{}): {}", i, j, value);
                return false;
            }
        }
    }

    double volume = cell.volume3D();
    if(volume <= 0 || std::isnan(volume) || std::isinf(volume)){
        spdlog::error("Invalid cell volume: {}", volume);
        return false;
    }

    return true;
}

json CoordinationAnalyzer::compute(const LammpsParser::Frame &frame, const std::string& outputFile){
    auto startTime = std::chrono::high_resolution_clock::now();
    json result;

    if(frame.natoms <= 0){
        result["is_failed"] = true;
        result["error"] = "Invalid number of atoms";
        return result;
    }

    if(!validateSimulationCell(frame.simulationCell)){
        result["is_failed"] = true;
        result["error"] = "Invalid simulation cell";
        return result;
    }

    auto positions = createPositionProperty(frame);
    if(!positions){
        result["is_failed"] = true;
        result["error"] = "Failed to create position property";
        return result;
    }

    spdlog::info("Starting coordination analysis (cutoff = {}, bins = {})...", _cutoff, _rdfBins);
    CoordinationNumber coordNumber;
    coordNumber.setCutoff(_cutoff);

    CoordinationNumber::CoordinationAnalysisEngine engine(
        positions.get(),
        frame.simulationCell,
        _cutoff,
        _rdfBins
    );

    engine.perform(),
    coordNumber.transferComputationResults(&engine);

    const auto &rdfX = coordNumber.rdfX();
    const auto &rdfY = coordNumber.rdY();

    auto coordProp = engine.coordinationNumbers();
    std::vector<int> coord(frame.natoms);
    for(int i = 0; i < frame.natoms; i++){
        coord[i] = coordProp->getInt(i);
    }

    result["is_failed"] = false;
    result["cutoff"] = _cutoff;
    result["rdf"]["x"] = rdfX;
    result["rdf"]["y"] = rdfY;
    result["coordination"] = coord;

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    result["duration"] = duration;

    if(!outputFile.empty()){
        _jsonExporter.writeJsonMsgpackToFile(result, outputFile + "_rdf.msgpack");
    }

    spdlog::debug("Coordination analysis time {} ms", duration);
    return result;
}

}

#include <opendxa/analyzers/cluster_analysis.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

ClusterAnalysisAnalyzer::ClusterAnalysisAnalyzer()
    : _cutoff(3.2),
      _sortBySize(true),
      _unwrapParticleCoordinates(false),
      _computeCentersOfMass(false),
      _computeRadiusOfGyration(false){}

void ClusterAnalysisAnalyzer::setCutoff(double cutoff){
    _cutoff = cutoff;
}

void ClusterAnalysisAnalyzer::setOptions(
    bool sortBySize,
    bool unwrapParticleCoordinates,
    bool computeCentersOfMass,
    bool computeRadiusOfGyration
){
    _sortBySize = sortBySize;
    _unwrapParticleCoordinates = unwrapParticleCoordinates;
    _computeCentersOfMass = computeCentersOfMass;
    _computeRadiusOfGyration = computeRadiusOfGyration;
}


std::shared_ptr<ParticleProperty> ClusterAnalysisAnalyzer::createPositionProperty(const LammpsParser::Frame &frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(frame.natoms, ParticleProperty::PositionProperty, 0, true));

    if(!property || property->size() != frame.natoms){
        spdlog::error("Failed to allocate ParticleProperty for positions with correct size");
        return nullptr;
    }

    Point3* data = property->dataPoint3();
    if(!data){
        spdlog::error("Failed to get position data pointer from ParticleProperty");
        return nullptr;
    }

    for(size_t i = 0; i < frame.positions.size() && i < static_cast<size_t>(frame.natoms); i++){
        data[i] = frame.positions[i];
    }

    return property;
}

json ClusterAnalysisAnalyzer::compute(const LammpsParser::Frame& frame, const std::string& outputFilename){
    auto startTime = std::chrono::high_resolution_clock::now();
    json result;

    if(frame.natoms <= 0){
        result["is_failed"] = true;
        result["error"] = "Invalid number of atoms";
        return result;
    }

    auto positions = createPositionProperty(frame);
    if(!positions){
        result["is_failed"] = true;
        result["error"] = "Failed to create position property";
        return result;
    }

    spdlog::info("Starting cluster analysis (cutoff = {}, sort = {}, unwrap = {}, com = {}, rg = {})...",
        _cutoff, _sortBySize, _unwrapParticleCoordinates, _computeCentersOfMass, _computeRadiusOfGyration);

    ClusterAnalysis::ClusterAnalysisEngine engine(
        positions.get(),
        frame.simulationCell,
        ClusterAnalysis::CutoffRange,
        _cutoff,
        _sortBySize,
        _unwrapParticleCoordinates,
        _computeCentersOfMass,
        _computeRadiusOfGyration
    );

    engine.perform();

    result["is_failed"] = false;
    result["cutoff"] = _cutoff;
    result["cluster_count"] = engine.numClusters();
    result["largest_cluster_size"] = engine.largestClusterSize();
    result["has_zero_weight_cluster"] = engine.hasZeroWeightCluster();

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    result["duration_ms"] = duration;

    if(!outputFilename.empty()){
        std::string path = outputFilename + "_clusters.msgpack";
        auto data = _jsonExporter.getClusterAnalysisData(engine, frame.ids);
        _jsonExporter.writeJsonMsgpackToFile(data, path);
        spdlog::info("Cluster analysis data written to {}", path);

        result["clusters"] = json::array();
    }

    return result;
}

}
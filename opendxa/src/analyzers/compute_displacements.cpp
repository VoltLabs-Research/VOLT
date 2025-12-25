#include <opendxa/analyzers/compute_displacements.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

DisplacementsAnalyzer::DisplacementsAnalyzer()
    : _hasReference(false),
      _useMinimumImageConvention(true),
      _affineMapping(ComputeDisplacements::AffineMappingType::NoMapping){}

void DisplacementsAnalyzer::setReferenceFrame(const LammpsParser::Frame &ref){
    _referenceFrame = ref;
    _hasReference = true;
}

void DisplacementsAnalyzer::setOptions(bool useMinimumImageConvention, ComputeDisplacements::AffineMappingType affineMapping){
    _useMinimumImageConvention = useMinimumImageConvention;
    _affineMapping = affineMapping;
}

std::shared_ptr<ParticleProperty> DisplacementsAnalyzer::createPositionProperty(const LammpsParser::Frame& frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(frame.natoms, ParticleProperty::PositionProperty, 0, true));

    if(!property || property->size() != static_cast<std::size_t>(frame.natoms)){
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

std::shared_ptr<ParticleProperty> DisplacementsAnalyzer::createIdentifierProperty(const LammpsParser::Frame& frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(frame.ids.size(), ParticleProperty::IdentifierProperty, 1, false));

    if(!property || property->size() != frame.ids.size()){
        spdlog::error("Failed to allocate ParticleProperty for identifiers with correct size");
        return nullptr;
    }

    for(size_t i = 0; i < frame.ids.size(); i++){
        property->setInt(i, frame.ids[i]);
    }

    return property;
}

json DisplacementsAnalyzer::compute(const LammpsParser::Frame& currentFrame, const std::string &outputFilename){
    auto startTime = std::chrono::high_resolution_clock::now();
    json result;

    if(currentFrame.natoms <= 0){
        result["is_failed"] = true;
        result["error"] = "Invalid number of atoms";
        return result;
    }

    const LammpsParser::Frame &refFrame = _hasReference ? _referenceFrame : currentFrame;

    if(currentFrame.natoms != refFrame.natoms){
        result["is_failed"] = true;
        result["error"] = "Atom count mismatch between current and reference frames";
        return result;
    }

    auto positions = createPositionProperty(currentFrame);
    if(!positions){
        result["is_failed"] = true;
        result["error"] = "Failed to create position property";
        return result;
    }

    auto refPositions = createPositionProperty(refFrame);
    if(!refPositions){
        result["is_failed"] = true;
        result["error"] = "Failed to create reference position property";
        return result;
    }

    auto identifiers = createIdentifierProperty(currentFrame);
    auto refIdentifiers = createIdentifierProperty(refFrame);
    if(!identifiers || !refIdentifiers){
        result["is_failed"] = true;
        result["error"] = "Failed to create identifier properties";
        return result;  
    }

    spdlog::info("Starting displacement analysis (MIC = {}, affineMapping = {})...",
        _useMinimumImageConvention ? "true" : "false",
        static_cast<int>(_affineMapping)
    );

    ComputeDisplacements engine(
        positions.get(),
        currentFrame.simulationCell,
        refPositions.get(),
        refFrame.simulationCell,
        identifiers.get(),
        refIdentifiers.get(),
        _useMinimumImageConvention,
        _affineMapping
    );

    engine.perform();

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    result["duration_ms"] = duration;

    if(!outputFilename.empty()){
        std::string path = outputFilename + "_displacements.msgpack";
        auto displacementData = _jsonExporter.getDisplacementsData(engine, currentFrame.ids);
        _jsonExporter.writeJsonMsgpackToFile(displacementData, path);
        spdlog::info("Displacement data written to {}", path);

        result["displacements"] = json::array();
    }

    return result;
}

}
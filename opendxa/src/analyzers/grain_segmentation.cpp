#include <opendxa/analyzers/grain_segmentation.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <spdlog/spdlog.h>
#include <map>

namespace OpenDXA{

using namespace OpenDXA::Particles;

GrainSegmentationAnalyzer::GrainSegmentationAnalyzer()
    : _rmsd(0.10f),
      _identificationMode(StructureAnalysis::Mode::PTM),
      _adoptOrphanAtoms(true),
      _minGrainAtomCount(100),
      _handleCoherentInterfaces(true),
      _outputBonds(false){}

void GrainSegmentationAnalyzer::setIdentificationMode(StructureAnalysis::Mode mode){
    _identificationMode = mode;
}

void GrainSegmentationAnalyzer::setRMSD(float rmsd){
    _rmsd = rmsd;
}

void GrainSegmentationAnalyzer::setParameters(
    bool adoptOrphanAtoms,
    int minGrainAtomCount,
    bool handleCoherentInterfaces,
    bool outputBonds
){
    _adoptOrphanAtoms = adoptOrphanAtoms;
    _minGrainAtomCount = minGrainAtomCount;
    _handleCoherentInterfaces = handleCoherentInterfaces;
    _outputBonds = outputBonds;
}

std::shared_ptr<ParticleProperty> GrainSegmentationAnalyzer::createPositionProperty(const LammpsParser::Frame &frame){
    if(!frame.positions || frame.positions->size() != static_cast<size_t>(frame.natoms)){
        spdlog::error("Failed to access position property");
        return nullptr;
    }

    return frame.positions;
}

json GrainSegmentationAnalyzer::compute(const LammpsParser::Frame &frame, const std::string &outputFilename){
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

    // Default preferred orientations (Identity)
    std::vector<Matrix3> preferredOrientations;
    preferredOrientations.push_back(Matrix3::Identity());

    auto structuretypes = std::make_unique<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);
    AnalysisContext context(
        positions.get(),
        frame.simulationCell,
        // Placeholder
        LATTICE_BCC,
        nullptr,
        structuretypes.get(),
        std::move(preferredOrientations)
    );

    auto structureAnalysis = std::make_unique<StructureAnalysis>(
        context,
        false,
        _identificationMode,
        _rmsd
    );

    {
        PROFILE("Identify Structures");
        structureAnalysis->identifyStructures();
    }

    std::vector<int> extractedStructureTypes;
    extractedStructureTypes.reserve(frame.natoms);
    for(int i = 0; i < frame.natoms; i++){
        extractedStructureTypes.push_back(structureAnalysis->context().structureTypes->getInt(i));
    }

    if(!outputFilename.empty()){
        if(_identificationMode == StructureAnalysis::Mode::PTM){
            _jsonExporter.exportPTMData(
                structureAnalysis->context(),
                frame.ids,
                outputFilename
            );
            // Export structure stats
            _jsonExporter.writeJsonMsgpackToFile(structureAnalysis->getStructureStatisticsJson(), outputFilename + "_structure_analysis_stats");
        }
        result = performGrainSegmentation(frame, *structureAnalysis, extractedStructureTypes, outputFilename);
    }else{
        result["is_failed"] = true;
    }

    return result;
}

json GrainSegmentationAnalyzer::performGrainSegmentation(
    const LammpsParser::Frame &frame,
    const StructureAnalysis &structureAnalysis,
    const std::vector<int>& structureTypes,
    const std::string &outputFile
){
    spdlog::info("Starting grain segmentation analysis...");
    std::string msgpackPath = outputFile + "_grains.msgpack";
    std::string metaPath = outputFile + "_grains_meta.msgpack";
    json result;

    try{
        const auto& ctx = structureAnalysis.context();
        if(!ctx.ptmOrientation || !ctx.correspondencesCode){
            spdlog::error("PTM orientation data not available. Grain segmentation requires PTM mode.");
            result["is_failed"] = true;
            result["error"] = "Grain segmentation requires PTM mode with orientation output enabled.";
            return result; 
        }

        // Create shared pointers for the engine
        auto positions = frame.positions;
        if(!positions || positions->size() != static_cast<size_t>(frame.natoms)){
            spdlog::error("Positions data is missing or invalid.");
            result["is_failed"] = true;
            result["error"] = "Positions data is missing or invalid.";
            return result;
        }

        auto structures = std::make_shared<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, false);
        for(size_t i = 0; i < structureTypes.size(); i++){
            structures->setInt(i, structureTypes[i]);
        }

        // PTM orientation property (quaternions: x, y, z, w)
        auto orientations = std::make_shared<ParticleProperty>(
            frame.natoms, DataType::Double, 4, 0, false);
        for(size_t i = 0; i < static_cast<size_t>(frame.natoms); i++){
            for(int c = 0; c < 4; c++){
                orientations->setDoubleComponent(i, c, ctx.ptmOrientation->getDoubleComponent(i, c));
            }
        }

        // Copy correspondences codes
        auto correspondences = std::make_shared<ParticleProperty>(
            frame.natoms, DataType::Int64, 1, 0, false);
        {
            auto* src = reinterpret_cast<const uint64_t*>(ctx.correspondencesCode->data());
            auto* dst = reinterpret_cast<uint64_t*>(correspondences->data());
            std::copy(src, src + frame.natoms, dst);
        }

        spdlog::info("Running GrainSegmentationEngine1 (building neighbor graph and dendrogram)...");
        auto engine1 = std::make_shared<GrainSegmentationEngine1>(
            positions,
            structures,
            orientations,
            correspondences,
            &frame.simulationCell,
            _handleCoherentInterfaces,
            _outputBonds
        );

        engine1->perform();
        
        spdlog::info("GrainSegmentationEngine1 complete. Dendrogram size: {}", engine1->dendrogram().size());
        spdlog::info("Suggested merging threshold: {:.4f}", engine1->suggestedMergingThreshold());
        spdlog::info("Running GrainSegmentationEngine2 (clustering atoms into grains)...");

        GrainSegmentationEngine2 engine2(
            engine1,
            _adoptOrphanAtoms,
            static_cast<size_t>(_minGrainAtomCount),
            true
        );

        engine2.perform();
        spdlog::info("Found {} grains", engine2.grainCount());

        auto atomClusters = engine2.atomClusters();
        std::vector<int> grainIds(frame.natoms, 0);
        for(size_t i = 0; i < static_cast<size_t>(frame.natoms); i++){
            grainIds[i] = atomClusters->getInt(i);
        }

        json grainData;
        grainData["grain_count"] = static_cast<int>(engine2.grainCount());
        grainData["merging_threshold"] = engine1->suggestedMergingThreshold();
        grainData["grains"] = json::array();

        for(const auto &grain : engine2.grains()){
            json grainInfo;
            grainInfo["id"] = grain.id;
            grainInfo["size"] = grain.size;
            grainInfo["orientation"] = {
                grain.orientation.x(), 
                grain.orientation.y(), 
                grain.orientation.z(), 
                grain.orientation.w()
            };
            grainData["grains"].push_back(grainInfo);
        }

        try{
            std::map<int, json> grainGroups;
            for(size_t i = 0; i < static_cast<size_t>(frame.natoms); i++){
                int gid = grainIds[i];
                json atomData;
                atomData["id"] = i;
                if(i < frame.positionCount()){
                    const auto &p = frame.position(i);
                    atomData["pos"] = {p.x(), p.y(), p.z()};
                }else{
                    atomData["pos"] = {0.0, 0.0, 0.0};
                }

                if(grainGroups.find(gid) == grainGroups.end()){
                    grainGroups[gid] = json::array();
                }

                grainGroups[gid].push_back(atomData);
            }

            json finalOutput;
            for(auto &[gid, atoms] : grainGroups){
                std::string key = (gid == 0) ? "Unassigned" : ("Grain_" + std::to_string(gid));
                finalOutput[key] = atoms;
            }

            _jsonExporter.writeJsonMsgpackToFile(finalOutput, msgpackPath);
        }catch(...){
            spdlog::error("Failed to export grains msgpack");
        }

        spdlog::info("Exported atoms msgpack to: {}", msgpackPath);
        _jsonExporter.writeJsonMsgpackToFile(grainData, metaPath);

        spdlog::info("Exported grain metadata msgpack to: {}", metaPath);

        result = grainData;
        result["is_failed"] = false;
    }catch(const std::exception& e){
        result["is_failed"] = true;
        result["error"] = std::string("Grain segmentation failed: ") + e.what();
        spdlog::error("Grain segmentation error: {}", e.what());
    }
    return result;
}

}

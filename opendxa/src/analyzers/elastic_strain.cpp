#include <opendxa/analyzers/elastic_strain.h>
#include <opendxa/analysis/elastic_strain.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

ElasticStrainAnalyzer::ElasticStrainAnalyzer()
    : _inputCrystalStructure(LATTICE_BCC),
      _identificationMode(StructureAnalysis::Mode::PTM),
      _rmsd(0.10f),
      _latticeConstant(1.63f),
      _caRatio(1.0),
      _pushForward(false),
      _calculateDeformationGradient(true),
      _calculateStrainTensors(true){}

void ElasticStrainAnalyzer::setInputCrystalStructure(LatticeStructureType structure){
    _inputCrystalStructure = structure;
}

void ElasticStrainAnalyzer::setIdentificationMode(StructureAnalysis::Mode mode){
    _identificationMode = mode;
}

void ElasticStrainAnalyzer::setRMSD(float rmsd){
    _rmsd = rmsd;
}

void ElasticStrainAnalyzer::setParameters(
    double latticeConstant,
    double caRatio,
    bool pushForward,
    bool calculateDeformationGradient,
    bool calculateStrainTensors
){
    _latticeConstant = latticeConstant;
    _caRatio = caRatio;
    _pushForward = pushForward;
    _calculateDeformationGradient = calculateDeformationGradient;
    _calculateStrainTensors = calculateStrainTensors;
}

std::shared_ptr<ParticleProperty> ElasticStrainAnalyzer::createPositionProperty(const LammpsParser::Frame &frame){
    if(!frame.positions || frame.positions->size() != static_cast<size_t>(frame.natoms)){
        spdlog::error("Failed to access position property");
        return nullptr;
    }

    return frame.positions;
}

json ElasticStrainAnalyzer::compute(const LammpsParser::Frame &frame, const std::string &outputFilename){
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

    std::vector<Matrix3> preferredOrientations;
    preferredOrientations.push_back(Matrix3::Identity());

    auto structureTypes = std::make_shared<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);
    ElasticStrainEngine engine(
        positions.get(),
        structureTypes.get(),
        frame.simulationCell,
        static_cast<LatticeStructureType>(_inputCrystalStructure),
        std::move(preferredOrientations),
        _calculateDeformationGradient,
        _calculateStrainTensors,
        _latticeConstant,
        _caRatio,
        _pushForward,
        _identificationMode,
        _rmsd
    );

    engine.perform();
    result["is_failed"] = false;

    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime).count();
    result["total_time"] = duration;

    if(!outputFilename.empty()){
        std::string path = outputFilename + "_elastic_strain.msgpack";
        auto elasticStrainData = _jsonExporter.getElasticStrainData(engine, frame.ids);
        _jsonExporter.writeJsonMsgpackToFile(elasticStrainData, path);
        spdlog::info("Elastic strain data written to {}", path);

        _jsonExporter.exportForStructureIdentification(frame, engine.structureAnalysis(), outputFilename);
    }

    if(!outputFilename.empty() && _identificationMode == StructureAnalysis::Mode::PTM){
        _jsonExporter.exportPTMData(
            engine.structureAnalysis().context(),
            frame.ids,
            outputFilename
        );
    }

    return result;
}
}

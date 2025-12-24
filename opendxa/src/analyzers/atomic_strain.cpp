#include <opendxa/analyzers/atomic_strain.h>
#include <opendxa/analysis/atomic_strain.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

AtomicStrainAnalyzer::AtomicStrainAnalyzer()
    : _cutoff(0.10),
      _eliminateCellDeformation(false),
      _assumeUnwrappedCoordinates(false),
      _calculateDeformationGradient(true),
      _calculateStrainTensors(true),
      _calculateD2min(true),
      _hasReference(false){}


void AtomicStrainAnalyzer::setCutoff(double cutoff){
    _cutoff = cutoff;
}

void AtomicStrainAnalyzer::setReferenceFrame(const LammpsParser::Frame &ref){
    _referenceFrame = ref;
    _hasReference = true;
}

void AtomicStrainAnalyzer::setOptions(
    bool eliminateCellDeformation,
    bool assumeUnwrappedCoordinates,
    bool calculateDeformationGradient,
    bool calculateStrainTensors,
    bool calculateD2min
){
    _eliminateCellDeformation = eliminateCellDeformation;
    _assumeUnwrappedCoordinates = assumeUnwrappedCoordinates;
    _calculateDeformationGradient = calculateDeformationGradient;
    _calculateStrainTensors = calculateStrainTensors;
    _calculateD2min = calculateD2min;
}

std::shared_ptr<ParticleProperty> AtomicStrainAnalyzer::createPositionProperty(const LammpsParser::Frame &frame){
    if(!frame.positions || frame.positions->size() != static_cast<size_t>(frame.natoms)){
        spdlog::error("Failed to access position property");
        return nullptr;
    }

    return frame.positions;
}

json AtomicStrainAnalyzer::compute(const LammpsParser::Frame& currentFrame, const std::string &outputFilename){
    const LammpsParser::Frame &refFrame = _hasReference ? _referenceFrame : currentFrame;

    auto positions = createPositionProperty(currentFrame);
    if(!positions){
        json res;
        res["is_failed"] = true;
        res["error"] = "Failed to create position property";
        return res;
    }

    json result = computeAtomicStrain(currentFrame, refFrame, positions.get(), outputFilename);
    result["is_failed"] = false;
    return result;
}

json AtomicStrainAnalyzer::computeAtomicStrain(
    const LammpsParser::Frame& currentFrame,
    const LammpsParser::Frame& refFrame,
    ParticleProperty* positions,
    const std::string& outputFilename
){
    if(currentFrame.natoms != refFrame.natoms){
        throw std::runtime_error("Cannot calculate atomic strain. Number of atoms in current and reference frames does not match.");
    }

    auto refPositions = refFrame.positions;
    if(!refPositions || refPositions->size() != static_cast<size_t>(refFrame.natoms)){
        throw std::runtime_error("Reference positions are missing or invalid.");
    }

    auto identifiers = std::make_shared<ParticleProperty>(
        currentFrame.ids.size(),
        ParticleProperty::IdentifierProperty,
        1,
        false
    );

    auto refIdentifiers = std::make_shared<ParticleProperty>(
        refFrame.ids.size(),
        ParticleProperty::IdentifierProperty,
        1,
        false
    );

    for(std::size_t i = 0; i < currentFrame.ids.size(); i++){
        identifiers->setInt(i, currentFrame.ids[i]);
        refIdentifiers->setInt(i, refFrame.ids[i]);
    }

    AtomicStrainModifier::AtomicStrainEngine engine(
        positions,
        currentFrame.simulationCell,
        refPositions.get(),
        refFrame.simulationCell,
        identifiers.get(),
        refIdentifiers.get(),
        _cutoff,
        _eliminateCellDeformation,
        _assumeUnwrappedCoordinates,
        _calculateDeformationGradient,
        _calculateStrainTensors,
        _calculateD2min
    );

    engine.perform();

    // calculate summary stats
    double totalShear = 0.0;
    double totalVolumetric = 0.0;
    double maxShear = 0.0;
    int count = 0;
    
    auto shear = engine.shearStrains();
    auto volumetric = engine.volumetricStrains();

    size_t n = currentFrame.positionCount();
    for(size_t i = 0; i < n; i++){
        if(shear){
            double s = shear->getDouble(i);
            totalShear += s;
            if(s > maxShear) maxShear = s;
        }

        if(volumetric){
            totalVolumetric += volumetric->getDouble(i);
        }
        count++;
    }

    json root;
    root["cutoff"] = _cutoff;
    root["num_invalid_particles"] = engine.numInvalidParticles();
    root["summary"] = {
        { "average_shear_strain", count > 0 ? totalShear / count : 0.0 },
        { "average_volumetric_strain", count > 0 ? totalVolumetric / count : 0.0 },
        { "max_shear_strain", maxShear }
    };

    if(!outputFilename.empty()){
        auto atomicStrainData = _jsonExporter.getAtomicStrainData(engine, currentFrame.ids);
        _jsonExporter.writeJsonMsgpackToFile(atomicStrainData, outputFilename + "_atomic_strain.msgpack");
        spdlog::info("Atomic strain data written to {}_atomic_strain.msgpack", outputFilename);
        root["atomic_strain"] = json::array();
    }else{
        root["atomic_strain"] = json::array();
        auto strainProp = engine.strainTensors();
        auto defgrad = engine.deformationGradients();
        auto D2minProp = engine.nonaffineSquaredDisplacements();
        auto invalid = engine.invalidParticles();

        // per atom properties
        for(std::size_t i = 0; i < currentFrame.positionCount(); i++){
            json a;
            a["id"] = currentFrame.ids[i];
            a["shear_strain"] = shear ? shear->getDouble(i) : 0.0;
            a["volumetric_strain"] = volumetric ? volumetric->getDouble(i) : 0.0;

            if(strainProp){
                double xx = strainProp->getDoubleComponent(i, 0);
                double yy = strainProp->getDoubleComponent(i, 1);
                double zz = strainProp->getDoubleComponent(i, 2);
                double yz = strainProp->getDoubleComponent(i, 3);
                double xz = strainProp->getDoubleComponent(i, 4);
                double xy = strainProp->getDoubleComponent(i, 5);
                a["strain_tensor"] = { xx, yy, zz, xy, xz, yz };
            }

            if(defgrad){
                double xx = defgrad->getDoubleComponent(i, 0);
                double yx = defgrad->getDoubleComponent(i, 1);
                double zx = defgrad->getDoubleComponent(i, 2);
                double xy = defgrad->getDoubleComponent(i, 3);
                double yy = defgrad->getDoubleComponent(i, 4);
                double zy = defgrad->getDoubleComponent(i, 5);
                double xz = defgrad->getDoubleComponent(i, 6);
                double yz = defgrad->getDoubleComponent(i, 7);
                double zz = defgrad->getDoubleComponent(i, 8);
                a["deformation_gradient"] = { xx, yx, zx, xy, yy, zy, xz, yz, zz };
            }

            if(D2minProp){
                a["D2min"] = D2minProp->getDouble(i);
            }else{
                a["D2min"] = nullptr;
            }

            if(invalid){
                a["invalid"] = (invalid->getInt(i) != 0);
            }else{
                a["invalid"] = false;
            }

            root["atomic_strain"].push_back(a);
        }
    }

    return root;
}

}

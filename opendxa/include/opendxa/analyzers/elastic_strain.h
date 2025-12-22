#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/utilities/json_exporter.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/analysis/structure_analysis.h>
#include <string>

namespace OpenDXA{
    
class ElasticStrainAnalyzer{
public:
    ElasticStrainAnalyzer();

    void setInputCrystalStructure(LatticeStructureType structure);
    void setIdentificationMode(StructureAnalysis::Mode mode);
    void setRMSD(float rmsd);

    void setParameters(
        double latticeConstant,
        double caRatio,
        bool pushForward,
        bool calculateDeformationGradient,
        bool calculateStrainTensors
    );

    json compute(
        const LammpsParser::Frame& frame,
        const std::string& outputFilename = ""
    );

private:
    LatticeStructureType _inputCrystalStructure;
    StructureAnalysis::Mode _identificationMode;
    float _rmsd;

    double _latticeConstant;
    double _caRatio;
    bool _pushForward;
    bool _calculateDeformationGradient;
    bool _calculateStrainTensors;

    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
};

}
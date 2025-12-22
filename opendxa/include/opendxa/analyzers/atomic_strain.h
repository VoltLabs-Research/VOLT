#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/utilities/json_exporter.h>
#include <opendxa/core/particle_property.h>
#include <string>

namespace OpenDXA{

class AtomicStrainAnalyzer{
public:
    AtomicStrainAnalyzer();

    void setCutoff(double cutoff);
    void setReferenceFrame(const LammpsParser::Frame &ref);
    void setOptions(
        bool eliminateCellDeformation,
        bool assumeUnwrappedCoordinates,
        bool calculateDeformationGradient,
        bool calculateStrainTensors,
        bool calculateD2min
    );

    json compute(
        const LammpsParser::Frame& currentFrame,
        const std::string& outputFilename = ""
    );

private:
    double _cutoff;
    bool _eliminateCellDeformation;
    bool _assumeUnwrappedCoordinates;
    bool _calculateDeformationGradient;
    bool _calculateStrainTensors;
    bool _calculateD2min;

    bool _hasReference;
    LammpsParser::Frame _referenceFrame;

    mutable DXAJsonExporter _jsonExporter;

    json computeAtomicStrain(
        const LammpsParser::Frame& currentFrame,
        const LammpsParser::Frame& refFrame,
        Particles::ParticleProperty* positions,
        const std::string& outputFilename
    );

    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
};
    
}

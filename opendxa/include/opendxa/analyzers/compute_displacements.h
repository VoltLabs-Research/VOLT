#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/json_exporter.h>
#include <opendxa/analysis/compute_displacements.h>

#include <memory>
#include <string>

namespace OpenDXA{
 
class DisplacementsAnalyzer{
public:
    DisplacementsAnalyzer();

    void setReferenceFrame(const LammpsParser::Frame &ref);
    void setOptions(bool useMinimumImageConvention, ComputeDisplacements::AffineMappingType affineMapping);

    json compute(const LammpsParser::Frame &currentFrame, const std::string &outputFilename);

private:
    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame& frame);
    std::shared_ptr<Particles::ParticleProperty> createIdentifierProperty(const LammpsParser::Frame& frame);

    bool _hasReference;
    LammpsParser::Frame _referenceFrame;

    bool _useMinimumImageConvention;
    ComputeDisplacements::AffineMappingType _affineMapping;

    DXAJsonExporter _jsonExporter;
};

}
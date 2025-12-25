#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/centrosymmetry.h>
#include <opendxa/utilities/json_exporter.h>

namespace OpenDXA{

class CentroSymmetryAnalyzer{
public:
    CentroSymmetryAnalyzer();

    void setNumNeighbors(int k);
    void setMode(CentroSymmetryAnalysis::CSPMode mode);

    json compute(const LammpsParser::Frame& frame, const std::string& outputBase);

private:
    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame& frame);

    int _k;
    CentroSymmetryAnalysis::CSPMode _mode;

    DXAJsonExporter _jsonExporter;
};

}

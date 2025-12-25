#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/analysis/cluster_analysis.h>
#include <opendxa/utilities/json_exporter.h>
#include <memory>

namespace OpenDXA{

class ClusterAnalysisAnalyzer{
public:
    ClusterAnalysisAnalyzer();

    void setCutoff(double cutoff);
    void setOptions(
        bool sortBySize,
        bool unwrapParticleCoordinates,
        bool computeCenterOfMass,
        bool computeRadiusOfGyration
    );

    json compute(const LammpsParser::Frame& frame, const std::string &outputFilename);

private:
    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame& frame);
    double _cutoff;
    bool _sortBySize;
    bool _unwrapParticleCoordinates;
    bool _computeCentersOfMass;
    bool _computeRadiusOfGyration;

    DXAJsonExporter _jsonExporter;
};

}
#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/utilities/json_exporter.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/analysis/coordination_analysis.h>
#include <string>

namespace OpenDXA{

class CoordinationAnalyzer{
public:
    CoordinationAnalyzer();

    void setCutoff(double cutoff);
    void setRdfBins(int bins);

    json compute(
        const LammpsParser::Frame &frame,
        const std::string &outputFilename = ""
    );

private:
    double _cutoff;
    int _rdfBins;

    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
    bool validateSimulationCell(const SimulationCell &cell);
};

}
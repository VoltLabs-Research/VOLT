#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <opendxa/analysis/elastic_mapping.h>
#include <opendxa/analysis/smooth_dislocations_modifier.h>
#include <opendxa/analysis/dislocation_tracer.h>
#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/math/lin_alg.h>
#include <opendxa/utilities/json_exporter.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

class DislocationAnalysis{
public:
    DislocationAnalysis()
        : _inputCrystalStructure(LATTICE_FCC),
        _maxTrialCircuitSize(14),
        _circuitStretchability(9),
        _onlyPerfectDislocations(false){}
    
    void setInputCrystalStructure(LatticeStructureType structure);
    void setMaxTrialCircuitSize(int size);
    void setCircuitStretchability(int stretch);
    void setOnlyPerfectDislocations(bool flag);
    bool compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile = "");
    
    json exportResultsToJson(const std::string& filename = "") const;

private:
    LatticeStructureType _inputCrystalStructure;
    int _maxTrialCircuitSize;
    int _circuitStretchability;
    bool _onlyPerfectDislocations;
    
    mutable json _lastJsonData;
    mutable LammpsParser::Frame _lastFrame;
    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
    bool validateSimulationCell(const SimulationCell &cell);
};

}


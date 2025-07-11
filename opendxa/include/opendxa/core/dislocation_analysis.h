#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <opendxa/analysis/elastic_mapping.h>
#include <opendxa/analysis/burgers_loop_builder.h>
#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/math/lin_alg.h>
#include <opendxa/utilities/json_exporter.h>
#include <semaphore>
#include <latch>
#include <format> 
#include <thread>
#include <barrier> 

namespace OpenDXA{

using namespace OpenDXA::Particles;

class DislocationAnalysis{
public:
    DislocationAnalysis()
        : _inputCrystalStructure(LATTICE_FCC),
        _maxTrialCircuitSize(14),
        _circuitStretchability(9),
        _lineSmoothingLevel(1),
        _linePointInterval(2.5),
        _defectMeshSmoothingLevel(8),
        _identificationMode(StructureAnalysis::Mode::CNA),
        _markCoreAtoms(false),
        _onlyPerfectDislocations(false){}
    
    void setInputCrystalStructure(LatticeStructureType structure);
    void setMaxTrialCircuitSize(double size);
    void setCircuitStretchability(double stretch);
    void setOnlyPerfectDislocations(bool flag);
    void setLineSmoothingLevel(double lineSmoothingLevel);
    void setLinePointInterval(double linePointInterval);
    void setIdentificationMode(StructureAnalysis::Mode identificationMode);
    void setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel);
    void setMarkCoreAtoms(bool markCoreAtoms);
    json compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile = "");
    json compute(const std::vector<LammpsParser::Frame>& frames, const std::string& output_file_template);

    json exportResultsToJson(const std::string& filename = "") const;

private:
    LatticeStructureType _inputCrystalStructure;

    double _maxTrialCircuitSize;
    double _circuitStretchability;
    double _lineSmoothingLevel;
    double _linePointInterval;
    double _defectMeshSmoothingLevel;
    StructureAnalysis::Mode _identificationMode;

    bool _markCoreAtoms;
    bool _onlyPerfectDislocations;
    
    mutable json _lastJsonData;
    mutable LammpsParser::Frame _lastFrame;
    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
    bool validateSimulationCell(const SimulationCell &cell);
};

}


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
#include <format> 
#include <vector>
#include <memory>
#include <string>

namespace OpenDXA {

class DislocationAnalysis {
public:
    DislocationAnalysis();

    void setInputCrystalStructure(LatticeStructureType structure);
    void setStructureIdentificationOnly(bool structureIdentificationOnly);
    
    void setMaxTrialCircuitSize(double size);
    void setCircuitStretchability(double stretch);
    void setLineSmoothingLevel(double lineSmoothingLevel);
    void setLinePointInterval(double linePointInterval);
    void setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel);
    
    void setOnlyPerfectDislocations(bool flag);
    void setMarkCoreAtoms(bool markCoreAtoms);
    
    void setIdentificationMode(StructureAnalysis::Mode identificationMode);
    void setRmsd(float rmsd);
    
    json compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile = "");

private:
    LatticeStructureType _inputCrystalStructure;

    double _maxTrialCircuitSize;
    double _circuitStretchability;
    double _lineSmoothingLevel;
    double _linePointInterval;
    double _defectMeshSmoothingLevel;

    float _rmsd;

    StructureAnalysis::Mode _identificationMode;

    bool _markCoreAtoms;
    bool _structureIdentificationOnly;
    bool _onlyPerfectDislocations;
    
    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
    bool validateSimulationCell(const SimulationCell &cell);
};

}

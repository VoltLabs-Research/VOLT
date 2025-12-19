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
#include <thread>
#include <fstream>
#include <map>
#include <algorithm>
#include <signal.h>
#include <errno.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

struct ProgressInfo{
    size_t completedFrames;
    size_t totalFrames;
    const nlohmann::json* frameResult;
};

using ProgressCallback = std::function<void(const ProgressInfo&)>;

class DislocationAnalysis{
public:
    DislocationAnalysis()
        : _inputCrystalStructure(LATTICE_FCC),
        _maxTrialCircuitSize(14),
        _circuitStretchability(9),
        _lineSmoothingLevel(10),
        _linePointInterval(2.5),
        _defectMeshSmoothingLevel(8),
        _structureIdentificationOnly(false),
        _grainSegmentationOnly(false),
        _identificationMode(StructureAnalysis::Mode::CNA),
        _markCoreAtoms(false),
        _coordinationAnalysisOnly(false),
        _coordinationCutoff(3.2),
        _coordinationRdfBins(500),
        _onlyPerfectDislocations(false){}

    void setCoordinationAnalysisOnly(bool flag);
    void setCoordinationCutoff(double cutoff);
    void setCoordinationRdfBins(int bins);

    void enableAtomicStrain(bool flag);
    void setAtomicStrainCutoff(double cutoff);
    void setAtomicStrainReferenceFrame(const LammpsParser::Frame &ref);
    void setAtomicStrainOptions(
        bool eliminateCellDeformation,
        bool assumeUnwrappedCoordinates,
        bool calculateDeformationGradient,
        bool calculateStrainTensors,
        bool calcD2min
    );
    
    void enableElasticStrain(bool flag);
    void setElasticStrainParameters(
        double latticeConstant,
        double caRatio,
        bool pushForward,
        bool calculateDeformationGradient,
        bool calculateStrainTensors
    );

    void setStructureIdentificationOnly(bool structureIdentificationOnly);
    void setGrainSegmentationOnly(bool grainSegmentationOnly);
    void setGrainSegmentationParameters(
        bool adoptOrphanAtoms,
        int minGrainAtomCount,
        bool handleCoherentInterfaces,
        bool outputBonds
    );
    void setInputCrystalStructure(LatticeStructureType structure);
    void setMaxTrialCircuitSize(double size);
    void setCircuitStretchability(double stretch);
    void setOnlyPerfectDislocations(bool flag);
    void setLineSmoothingLevel(double lineSmoothingLevel);
    void setLinePointInterval(double linePointInterval);
    void setIdentificationMode(StructureAnalysis::Mode identificationMode);
    void setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel);
    void setMarkCoreAtoms(bool markCoreAtoms);
    void setRmsd(float rmsd);
    json compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile = "");

    json computeAtomicStrain(
        const LammpsParser::Frame &currentFrame,
        const LammpsParser::Frame &refFrame,
        Particles::ParticleProperty *positions,
        const std::string& outputFilename = ""
    );

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
    bool _grainSegmentationOnly;
    bool _onlyPerfectDislocations;
   
    bool _coordinationAnalysisOnly;
    double _coordinationCutoff;
    int _coordinationRdfBins;

    bool _grainAdoptOrphanAtoms = true;
    int _grainMinAtomCount = 100;
    bool _grainHandleCoherentInterfaces = true;
    bool _grainOutputBonds = false;

    bool  _atomicStrainEnabled;
    double _atomicStrainCutoff;
    bool  _atomicStrainEliminateCellDeformation;
    bool  _atomicStrainAssumeUnwrappedCoordinates;
    bool  _atomicStrainCalcDeformationGradients;
    bool  _atomicStrainCalcStrainTensors;
    bool  _atomicStrainCalcNonaffineSquaredDisplacements;

    bool  _hasAtomicStrainReference;
    LammpsParser::Frame _atomicStrainReferenceFrame;

    bool _elasticStrainEnabled = false;
    double _elasticLatticeConstant = 1.0;
    double _elasticCaRatio = 1.0;
    bool _elasticPushForward = false;
    bool _elasticCalcDefGrad = true;
    bool _elasticCalcStrainTensors = true;
    
    mutable json _lastJsonData;
    mutable LammpsParser::Frame _lastFrame;
    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);
    bool validateSimulationCell(const SimulationCell &cell);
    json performGrainSegmentation(const LammpsParser::Frame &frame, const StructureAnalysis& structureAnalysis, 
                                  const std::vector<int>& structureTypes, const std::string& outputFile);
    void exportGrainModelAsGLB(const LammpsParser::Frame &frame, const std::vector<int>& grainIds, 
                               const std::string& outputPath);
};

}


#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/utilities/json_exporter.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/grain_segmentation.h>
#include <string>

namespace OpenDXA{

class GrainSegmentationAnalyzer{
public:
    GrainSegmentationAnalyzer();
    
    void setIdentificationMode(StructureAnalysis::Mode mode);
    void setRMSD(float rmsd);

    void setParameters(
        bool adoptOrphanAtoms,
        int minGrainAtomCount,
        bool handleCoherentInterfaces,
        bool outputBonds
    );

    json compute(
        const LammpsParser::Frame &frame,
        const std::string &outputFilename = ""
    );

private:
    float _rmsd;
    StructureAnalysis::Mode _identificationMode;

    bool _adoptOrphanAtoms;
    int _minGrainAtomCount;
    bool _handleCoherentInterfaces;
    bool _outputBonds;

    mutable DXAJsonExporter _jsonExporter;

    std::shared_ptr<Particles::ParticleProperty> createPositionProperty(const LammpsParser::Frame &frame);

    json performGrainSegmentation(
        const LammpsParser::Frame &frame,
        const StructureAnalysis& structureAnalysis,
        const std::vector<int>& structureTypes,
        const std::string& outputFile
    );

    void exportGrainModelAsGLB(
        const LammpsParser::Frame &frame,
        const std::vector<int>& grainIds,
        const std::string& outputPath
    );
};

}
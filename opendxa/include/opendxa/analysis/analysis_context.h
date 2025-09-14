#pragma once
#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/structures/lattice_structure.h>

namespace OpenDXA{

class AnalysisContext{
public:
    // Particle properties
    ParticleProperty* positions;
    ParticleProperty* structureTypes;
    ParticleProperty* particleSelection;
    std::shared_ptr<ParticleProperty> neighborLists;
    std::shared_ptr<ParticleProperty> atomClusters;
    std::shared_ptr<ParticleProperty> atomSymmetryPermutations;

    // PTM
    std::shared_ptr<ParticleProperty> ptmRmsd;
    std::shared_ptr<ParticleProperty> ptmOrientation;
    std::shared_ptr<ParticleProperty> ptmDeformationGradient;
    std::shared_ptr<ParticleProperty> correspondencesCode;
    std::shared_ptr<ParticleProperty> templateIndex;

    // Simulation
    const SimulationCell& simCell;
    LatticeStructureType inputCrystalType;
    std::vector<Matrix3> preferredCrystalOrientations;

    AnalysisContext(
        ParticleProperty* pos,
        const SimulationCell& cell,
        LatticeStructureType crystalType,
        ParticleProperty* selection,
        ParticleProperty* outputStructures,
        std::vector<Matrix3>&& preferredOrientations
    );
        
    size_t atomCount() const{
        return positions->size(); 
    }
};

}
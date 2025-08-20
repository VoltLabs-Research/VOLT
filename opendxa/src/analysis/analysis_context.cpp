#include <opendxa/analysis/analysis_context.h>
#include <opendxa/structures/crystal_structure_types.h>

namespace OpenDXA{

AnalysisContext::AnalysisContext(
    ParticleProperty* pos,
    const SimulationCell& cell,
    LatticeStructureType crystalType,
    ParticleProperty* selection,
    ParticleProperty* outputStructures,
    std::vector<Matrix3>&& preferredOrientations
) : 
    positions(pos),
    structureTypes(outputStructures),
    particleSelection(selection),
    simCell(cell),
    inputCrystalType(crystalType),
    preferredCrystalOrientations(std::move(preferredOrientations)),
    
    neighborLists(nullptr),
    ptmRmsd(nullptr),
    ptmOrientation(nullptr),
    ptmDeformationGradient(nullptr)
{
    if(!positions || !structureTypes){
        throw std::invalid_argument("Invalid positions or structure types");
    }

    const size_t numAtoms = atomCount();

    atomClusters = std::make_shared<ParticleProperty>(numAtoms, DataType::Int, 1, 0, true);
    atomSymmetryPermutations = std::make_shared<ParticleProperty>(numAtoms, DataType::Int, 1, 0, false);

    if(numAtoms > 0){
        std::fill(
            structureTypes->dataInt(),
            structureTypes->dataInt() + numAtoms,
            LATTICE_OTHER
        );
    }
}

}
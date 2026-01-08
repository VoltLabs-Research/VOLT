#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <opendxa/analysis/ptm_neighbor_finder.h>
#include <ptm_constants.h>
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <tbb/parallel_reduce.h>
#include <execution>
#include <ranges>
#include <numeric>

namespace OpenDXA {

StructureAnalysis::StructureAnalysis(
    AnalysisContext& context,
    bool identifyPlanarDefects, 
    Mode identificationMode,
    float rmsd
) :
    _context(context),
    _identificationMode(identificationMode),
    _rmsd(rmsd),    
    _clusterGraph(std::make_unique<ClusterGraph>()),
    _coordStructures(
        _context.structureTypes, 
        context.inputCrystalType, 
        identifyPlanarDefects, 
        context.simCell
    )
{
    static std::once_flag init_flag;
    std::call_once(init_flag, []() {
        CoordinationStructures::initializeStructures();
    });

    int requestedMaxNeighbors = 0;
    if(usingPTM()){
        requestedMaxNeighbors = PTM_MAX_NBRS;
    }else{
        requestedMaxNeighbors = std::max(
            _coordStructures.getLatticeStruct(_context.inputCrystalType).maxNeighbors,
            _coordStructures.getCoordinationNumber()
        );
        if(requestedMaxNeighbors <= 0) requestedMaxNeighbors = 1;
    }

    _context.atomSymmetryPermutations = std::make_shared<ParticleProperty>(
        _context.atomCount(), DataType::Int, 1, 0, true);

    _context.neighborLists = std::make_shared<ParticleProperty>(
        _context.atomCount(), DataType::Int,
        static_cast<size_t>(requestedMaxNeighbors),
        0, false
    );

    _context.templateIndex = std::make_shared<ParticleProperty>(
        _context.atomCount(), DataType::Int, 1, 0, true);

    std::fill(_context.neighborLists->dataInt(),
              _context.neighborLists->dataInt() + _context.neighborLists->size()*_context.neighborLists->componentCount(),
              -1);
    std::fill(_context.structureTypes->dataInt(),
              _context.structureTypes->dataInt() + _context.structureTypes->size(),
              LATTICE_OTHER);
}

json StructureAnalysis::getAtomsData(
    const LammpsParser::Frame &frame,
    const std::vector<int>* structureTypes
){
    std::map<std::string, json> groupedAtoms;

    for(size_t i = 0; i < frame.natoms; ++i){
        int structureType = 0;
        if(structureTypes && i < static_cast<int>(structureTypes->size())){
            structureType = (*structureTypes)[i];
        }

        std::string typeName = getStructureTypeName(structureType);
        
        json atomJson;
        atomJson["id"] = i;
        atomJson["structure_type"] = structureType;

        if(usingPTM()){
            //Quaternion quat = getPTMAtomOrientation(i);
            //atomJson["ptm_quaternion"] = {quat.x(), quat.y(), quat.z(), quat.w()};
        }

        if(i < static_cast<int>(frame.positions.size())){
            const auto &pos = frame.positions[i];
            atomJson["pos"] = {pos.x(), pos.y(), pos.z()};
        }else{
            atomJson["pos"] = {0.0, 0.0, 0.0};
        }

        if(!groupedAtoms[typeName].is_array()){
            groupedAtoms[typeName] = json::array();
        }

        groupedAtoms[typeName].push_back(atomJson);
    }

    return json(groupedAtoms);
}

bool StructureAnalysis::setupPTM(OpenDXA::PTM& ptm, size_t N){
    ptm.setCalculateDefGradient(true);
    ptm.setRmsdCutoff(std::numeric_limits<double>::infinity());
    
    return ptm.prepare(_context.positions->constDataPoint3(), N, _context.simCell);
}

void StructureAnalysis::storeNeighborIndices(const PTM::Kernel& kernel, size_t atomIndex){
    int numNeighbors = kernel.numTemplateNeighbors();
    assert(numNeighbors <= _context.neighborLists->componentCount());
    
    for(int j = 0; j < numNeighbors; ++j){
        _context.neighborLists->setIntComponent(atomIndex, j, kernel.getTemplateNeighbor(j).index);
    }
}

void StructureAnalysis::storeOrientationData(const PTM::Kernel& kernel, size_t atomIndex){
    auto quaternion = kernel.orientation();
    double* orientation = _context.ptmOrientation->dataDouble() + 4 * atomIndex;
    
    orientation[0] = quaternion.x();
    orientation[1] = quaternion.y();
    orientation[2] = quaternion.z();
    orientation[3] = quaternion.w();
}

void StructureAnalysis::storeDeformationGradient(const PTM::Kernel& kernel, size_t atomIndex) {
    const auto& F = kernel.deformationGradient();
    double* F_dest = _context.ptmDeformationGradient->dataDouble() + 9 * atomIndex;
    const double* F_src = F.elements();
    
    for(int k = 0; k < 9; ++k){
        F_dest[k] = F_src[k];
    }
}

int StructureAnalysis::findClosestSymmetryPermutation(int structureType, const Matrix3& rotation){
    const LatticeStructure& lattice = CoordinationStructures::getLatticeStruct(structureType);
    int bestIndex = 0;
    double bestDeviation = std::numeric_limits<double>::max();

    for(int i = 0; i < lattice.permutations.size(); ++i){
        const Matrix3& sym = lattice.permutations[i].transformation;
        double deviation = 0;
        for(int r = 0; r < 3; ++r){
            for(int c = 0; c < 3; ++c){
                double diff = rotation(r, c) - sym(r, c);
                deviation += diff * diff;
            }
        }
        if(deviation < bestDeviation){
            bestDeviation = deviation;
            bestIndex = i;
        }
    }
    return bestIndex;
}

// Compute the maximum distance of any neighbor from a crystalline atom
void StructureAnalysis::computeMaximumNeighborDistanceFromPTM(){
    const size_t N = _context.atomCount();
    if(N == 0){
        _maximumNeighborDistance = 0.0;
        return;
    }

    const int M = _context.neighborLists->componentCount();
    const auto* pos = _context.positions->constDataPoint3();
    const auto& invMat = _context.simCell.inverseMatrix();
    const auto& dirMat = _context.simCell.matrix();

    auto indices = std::views::iota(size_t{0}, N);

    double maxDistance = std::transform_reduce(
        std::execution::par,
        indices.begin(),
        indices.end(),
        0.0,
        [](double a, double b) { return std::max(a, b); },
        [&](size_t i){
            double localMaxDist = 0.0;
            for(int j = 0; j < M; ++j){
                int nb = _context.neighborLists->getIntComponent(i, j);
                if(nb < 0) break;

                Vector3 delta = pos[nb] - pos[i];
                double f[3];
                for(int d = 0; d < 3; ++d){
                    f[d] = invMat.prodrow(delta, d);
                    f[d] -= std::round(f[d]);
                }

                Vector3 mind;
                mind = dirMat.column(0) * f[0];
                mind += dirMat.column(1) * f[1];
                mind += dirMat.column(2) * f[2];
                double d = mind.length();
                if(d > localMaxDist) localMaxDist = d;
            }
            return localMaxDist;
        }
    );

    spdlog::debug("Maximum neighbor distance (from PTM): {}", maxDistance);
    _maximumNeighborDistance = maxDistance;
}

// Runs the Polyhedral Template Matching (PTM) algorithm on every atom,
// collects raw RMSD values (with no initial cutoff).
void StructureAnalysis::determineLocalStructuresWithPTM() {
    const size_t N = _context.atomCount();
    if(!N) return;

    OpenDXA::PTM ptm;
    if(!setupPTM(ptm, N)){
        throw std::runtime_error("Error trying to initialize PTM.");
    }

    _context.ptmOrientation = std::make_shared<ParticleProperty>(N, DataType::Double, 4, 0.0, true);
    _context.ptmDeformationGradient = std::make_shared<ParticleProperty>(N, DataType::Double, 9, 0.0, true);
    _context.ptmRmsd = std::make_shared<ParticleProperty>(N, DataType::Double, 1, 0.0, true);
    _context.correspondencesCode = std::make_shared<ParticleProperty>(N, DataType::Int64, 1, 0, true);

    // Clear arrays for second pass
    std::fill(_context.neighborLists->dataInt(),
              _context.neighborLists->dataInt() + _context.neighborLists->size()*_context.neighborLists->componentCount(), -1);
    std::fill(_context.structureTypes->dataInt(),
              _context.structureTypes->dataInt() + _context.structureTypes->size(), LATTICE_OTHER);

    std::vector<uint64_t> cached(N, 0ull);

    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto &r){
        PTM::Kernel kernel(ptm);
        for(size_t i = r.begin(); i < r.end(); ++i){
            kernel.cacheNeighbors(i, &cached[i]);
            StructureType type = kernel.identifyStructure(i, cached);

            const double rmsd = kernel.rmsd();
            _context.ptmRmsd->setDouble(i, rmsd);

            auto* c = reinterpret_cast<uint64_t*>(_context.correspondencesCode->data());
            c[i] = kernel.correspondencesCode();

            // Only keep atoms whose RMSD <= finalCutoff
            if(type == StructureType::OTHER || rmsd > _rmsd){
                continue;
            }

            _context.structureTypes->setInt(i, type);
            storeNeighborIndices(kernel, i);
            storeOrientationData(kernel, i);
            storeDeformationGradient(kernel, i);
            _context.templateIndex->setInt(i, kernel.bestTemplateIndex());
        }
    });
}

void StructureAnalysis::identifyStructuresCNA(){
    int maxNeighborListSize = std::min((int)_context.neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
    NearestNeighborFinder neighFinder(maxNeighborListSize);
    if(!neighFinder.prepare(_context.positions, _context.simCell, _context.particleSelection)){
        throw std::runtime_error("Error in neighFinder.preapre(...)");
    }

    _maximumNeighborDistance = tbb::parallel_reduce(tbb::blocked_range<size_t>(0, _context.atomCount()),
        0.0, [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
            for(size_t index = r.begin(); index != r.end(); ++index){
                double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _context.neighborLists);
                if (localMaxDistance > max_dist_so_far) {
                    max_dist_so_far = localMaxDistance;
                }
            }
            return max_dist_so_far;
        },
        [](double a, double b) -> double {
            return std::max(a, b);
        }
    );
}

void StructureAnalysis::identifyStructures(){
    if(usingPTM()){
        determineLocalStructuresWithPTM();
        computeMaximumNeighborDistanceFromPTM();
        return;
    }

    identifyStructuresCNA();
}

}
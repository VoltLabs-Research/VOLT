#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
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
        // take the max between the lattice-definition maxNeighbors and the coordination
        // number the algorithm expects (safety for diamond where coord. number = 16).
        requestedMaxNeighbors = std::max(
            _coordStructures.latticeStructure(_context.inputCrystalType).maxNeighbors,
            _coordStructures.getCoordinationNumber()
        );
        // defensive: ensure at least 1
        if(requestedMaxNeighbors <= 0) requestedMaxNeighbors = 1;
    }

    _context.neighborLists = std::make_shared<ParticleProperty>(
        _context.atomCount(),
        DataType::Int,
        static_cast<size_t>(requestedMaxNeighbors),
        0,
        false
    );


    std::fill(_context.neighborLists->dataInt(), _context.neighborLists->dataInt() + _context.neighborLists->size() * _context.neighborLists->componentCount(), -1);
    std::fill(_context.structureTypes->dataInt(), _context.structureTypes->dataInt() + _context.structureTypes->size(), LATTICE_OTHER);
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
    double* orientation = _context.ptmOrientation->dataFloat() + 4 * atomIndex;
    
    orientation[0] = static_cast<float>(quaternion.x());
    orientation[1] = static_cast<float>(quaternion.y());
    orientation[2] = static_cast<float>(quaternion.z());
    orientation[3] = static_cast<float>(quaternion.w());
}

void StructureAnalysis::storeDeformationGradient(const PTM::Kernel& kernel, size_t atomIndex) {
    const auto& F = kernel.deformationGradient();
    double* F_dest = _context.ptmDeformationGradient->dataFloat() + 9 * atomIndex;
    const double* F_src = F.elements();
    
    for(int k = 0; k < 9; ++k){
        F_dest[k] = static_cast<float>(F_src[k]);
    }
}

void StructureAnalysis::processPTMAtom(
    PTM::Kernel& kernel,
    size_t atomIndex,
    StructureType type,
    const std::vector<uint64_t>& cached,
    float cutoff
){
    float rmsd = _context.ptmRmsd->getFloat(atomIndex);
    if(rmsd > cutoff) return;
    
    kernel.identifyStructure(atomIndex, cached);
    
    storeNeighborIndices(kernel, atomIndex);
    _context.structureTypes->setInt(atomIndex, type);
    storeOrientationData(kernel, atomIndex);
    storeDeformationGradient(kernel, atomIndex);
}

/// This maximum sets a safe "search radius"
/// for all later routines (e.g. ghost‐layer size in Delaunay, node‐connect threshold in
/// mesh building) so we reliably include every bond in subsequent stages.
void StructureAnalysis::computeMaximumNeighborDistance(){
    const size_t N = _context.atomCount();
    if(N == 0){
        _maximumNeighborDistance = 0.0;
        return;
    }

    // Hack for DIAMOND
    if(_context.inputCrystalType == LatticeStructureType::LATTICE_CUBIC_DIAMOND || !usingPTM()){
        int maxNeighborListSize = std::min((int)_context.neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
        NearestNeighborFinder neighFinder(maxNeighborListSize);
        if(!neighFinder.prepare(_context.positions, _context.simCell, _context.particleSelection)){
            throw std::runtime_error("Error in neighFinder.prepare(...)");
        }

        _maximumNeighborDistance = tbb::parallel_reduce(tbb::blocked_range<size_t>(0, _context.atomCount()),
            0.0, [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
                for(size_t index = r.begin(); index != r.end(); ++index){
                    double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _context.neighborLists);
                    if(localMaxDistance > max_dist_so_far){
                        max_dist_so_far = localMaxDistance;
                    }
                }
                return max_dist_so_far;
            },
            [](double a, double b) -> double {
                return std::max(a, b);
            }
        );


        if(_identificationMode == StructureAnalysis::Mode::DIAMOND){
            _coordStructures.postProcessDiamondNeighbors(_context, neighFinder);
        }
        
        return;
    }

    // PTM
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


/// Once we have neighbor lists from PTM, find the single largest atom‐to‐neighbor
/// distance (respecting periodic wrapping).  This maximum sets a safe "search radius"
/// for all later routines (e.g. ghost‐layer size in Delaunay, node‐connect threshold in
/// mesh building) so we reliably include every bond in subsequent stages.
//
// TODO: MAYBE DIAMOND PROBLEM HERE??!
void StructureAnalysis::computeMaximumNeighborDistanceFromPTM(){
    const size_t N = _context.atomCount();
    if(N == 0){
        _maximumNeighborDistance = 0.0;
        return;
    }

    // Hack for DIAMOND
    if(_context.inputCrystalType == LatticeStructureType::LATTICE_CUBIC_DIAMOND || !usingPTM()){
        int maxNeighborListSize = std::min((int)_context.neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
        NearestNeighborFinder neighFinder(maxNeighborListSize);
        if(!neighFinder.prepare(_context.positions, _context.simCell, _context.particleSelection)){
            throw std::runtime_error("Error in neighFinder.prepare(...)");
        }

        _maximumNeighborDistance = tbb::parallel_reduce(tbb::blocked_range<size_t>(0, N),
            0.0, [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
                for(size_t index = r.begin(); index != r.end(); ++index){
                    double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _context.neighborLists);
                    if(localMaxDistance > max_dist_so_far){
                        max_dist_so_far = localMaxDistance;
                    }
                }
                return max_dist_so_far;
            },
            [](double a, double b) -> double {
                return std::max(a, b);
            }
        );


        std::cout << "OK RETURN" << std::endl;
        return;
    }

    // PTM
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
    if (N == 0) return;

    OpenDXA::PTM ptm;
    if (!setupPTM(ptm, N)) {
        throw std::runtime_error("Error trying to initialize PTM.");
    }

    _context.ptmOrientation = std::make_shared<ParticleProperty>(N, DataType::Float, 4, 0.0f, true);
    _context.ptmDeformationGradient = std::make_shared<ParticleProperty>(N, DataType::Float, 9, 0.0f, true);
    
    // Clear arrays for second pass
    std::fill(_context.neighborLists->dataInt(), 
              _context.neighborLists->dataInt() + _context.neighborLists->size() * _context.neighborLists->componentCount(), -1);
    std::fill(_context.structureTypes->dataInt(), 
              _context.structureTypes->dataInt() + _context.structureTypes->size(), LATTICE_OTHER);

    _context.ptmRmsd = std::make_shared<ParticleProperty>(N, DataType::Float, 1, 0.0f, true);
    std::vector<uint64_t> cached(N, 0ull);
    std::vector<StructureType> ptmTypes(N);

    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto& r) {
        PTM::Kernel kernel(ptm);
        for(size_t i = r.begin(); i < r.end(); ++i){
            kernel.cacheNeighbors(i, &cached[i]);
            ptmTypes[i] = kernel.identifyStructure(i, cached);
            _context.ptmRmsd->setFloat(i, static_cast<float>(kernel.rmsd()));
            storeOrientationData(kernel, i);
        }
    });

    // Only keep atoms whose RMSD <= finalCutoff
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto &r){
        PTM::Kernel kernel(ptm);
        for(size_t i = r.begin(); i < r.end(); ++i){
            processPTMAtom(kernel, i, ptmTypes[i], cached, _rmsd);
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
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <opendxa/math/affine_transformation.h>

#include <cassert>
#include <cstring> 
#include <cmath> 
#include <stdexcept>

namespace OpenDXA{

// Converts a raw integer code from the PTM library into our high-level enum.
// This bridges the C API (which returns PTM_MATCH_*) to our StructureType values.
StructureType PTM::ptmToStructureType(int type){
    switch(type){
        case PTM_MATCH_NONE: return StructureType::OTHER;
        case PTM_MATCH_SC: return StructureType::SC;
        case PTM_MATCH_FCC: return StructureType::FCC;
        case PTM_MATCH_HCP: return StructureType::HCP;
        case PTM_MATCH_ICO: return StructureType::ICO;
        case PTM_MATCH_BCC: return StructureType::BCC;
        case PTM_MATCH_DCUB: return StructureType::CUBIC_DIAMOND;
        case PTM_MATCH_DHEX: return StructureType::HEX_DIAMOND;
        case PTM_MATCH_GRAPHENE: return StructureType::GRAPHENE;
        default: assert(false); return StructureType::OTHER;
    }
}

// Maps our enum values back into the integer codes expected by the PTM C routines.
// This lets us selectively enable or disable each lattice type in the library calls.
int PTM::toPtmStructureType(StructureType type){
    switch (type) {
        case StructureType::OTHER: return PTM_MATCH_NONE;
        case StructureType::SC: return PTM_MATCH_SC;
        case StructureType::FCC: return PTM_MATCH_FCC;
        case StructureType::HCP: return PTM_MATCH_HCP;
        case StructureType::ICO: return PTM_MATCH_ICO;
        case StructureType::BCC: return PTM_MATCH_BCC;
        case StructureType::CUBIC_DIAMOND: return PTM_MATCH_DCUB;
        case StructureType::HEX_DIAMOND: return PTM_MATCH_DHEX;
        case StructureType::GRAPHENE: return PTM_MATCH_GRAPHENE;
        default: 
            spdlog::warn("PTM::toPtmStructureType: is not mapped = {}, PTM_MATCH_NONE as fallback", static_cast<int>(type));
            return PTM_MATCH_NONE;
    }
}

// Initialize the PTM algorithm, including global one-time setup and neighbor-search capacity.
// By deriving from NearestNeighborFinder, we reserve space for the maximum neighbor PTM needs
PTM::PTM() : NearestNeighborFinder(MAX_INPUT_NEIGHBORS){
    ptm_initialize_global();
}

// Collects and encodes the local neighbor shell around a particle into a bitmask.
// This lets the PTM algorithm quickly refer back to which neighbor belong where.
int PTM::Kernel::cacheNeighbors(size_t particleIndex, uint64_t* res){
    //assert(particleIndex < _algorithm.particleCount());
    
    findNeighbors(particleIndex, false);
    int numNeighbors = this->results().size();

    double points[PTM_MAX_INPUT_POINTS - 1][3];
    for(int i = 0; i < numNeighbors; i++){
        points[i][0] = this->results()[i].delta.x();
        points[i][1] = this->results()[i].delta.y();
        points[i][2] = this->results()[i].delta.z();
    }

    return ptm_preorder_neighbours(_handle, numNeighbors, points, res);
}

// Initializes all spatial indexing, periodic-image offsets, and builds
// a shallow k-d tree for fast neighbor searches in the current simulation frame.
bool PTM::prepare(
    const Point3* positions,
    size_t particleCount,
    const SimulationCell& cellData
){
    //assert(positions);
    _particleCount = particleCount;
    simCell = cellData;

    if(simCell.volume3D() <= EPSILON){
        throw std::runtime_error("Simulation cell is degenerated.");
    }
 
    planeNormals[0] = simCell.cellNormalVector(0);
    planeNormals[1] = simCell.cellNormalVector(1);
    planeNormals[2] = simCell.cellNormalVector(2);

    pbcImages.clear();
    int nx = simCell.pbcFlags()[0] ? 1 : 0;
    int ny = simCell.pbcFlags()[1] ? 1 : 0;
    int nz = simCell.pbcFlags()[2] ? 1 : 0;

    for(int iz = -nz; iz <= nz; iz++){
        for(int iy = -ny; iy <= ny; iy++){
            for(int ix = -nx; ix <= nx; ix++){
                pbcImages.push_back(simCell.matrix() * Vector3(ix, iy, iz));
            }
        }
    }

    std::sort(pbcImages.begin(), pbcImages.end(), [](const Vector3& a, const Vector3& b){
        return a.squaredLength() < b.squaredLength();
    });

    Box3 boundingBox(Point3(0, 0, 0), Point3(1, 1, 1));
    if(!simCell.pbcFlags()[0] || !simCell.pbcFlags()[1] || !simCell.pbcFlags()[2]){
        for(size_t i = 0; i < particleCount; ++i){
            const Point3& p = positions[i];
            Point3 reducedp = simCell.absoluteToReduced(p);
            if(!simCell.pbcFlags()[0]){
                if(reducedp.x() < boundingBox.minc.x()){
                    boundingBox.minc.x() = reducedp.x();
                }else if(reducedp.x() > boundingBox.maxc.x()){
                    boundingBox.maxc.x() = reducedp.x();
                }
            }

            if(!simCell.pbcFlags()[1]){
                if(reducedp.y() < boundingBox.minc.y()){
                    boundingBox.minc.y() = reducedp.y();
                }else if(reducedp.y() > boundingBox.maxc.y()){
                    boundingBox.maxc.y() = reducedp.y();
                }
            }

            if(!simCell.pbcFlags()[2]){
                if(reducedp.z() < boundingBox.minc.z()){
                    boundingBox.minc.z() = reducedp.z();
                }else if(reducedp.z() > boundingBox.maxc.z()){
                    boundingBox.maxc.z() = reducedp.z();
                }
            }
        }
    }

    root = nodePool.construct();
    root->bounds = boundingBox;
    numLeafNodes = 1;
    
    splitLeafNode(root, 0);
    splitLeafNode(root->children[0], 1);
    splitLeafNode(root->children[1], 1);
    splitLeafNode(root->children[0]->children[0], 2);
    splitLeafNode(root->children[0]->children[1], 2);
    splitLeafNode(root->children[1]->children[0], 2);
    splitLeafNode(root->children[1]->children[1], 2);

    atoms.resize(particleCount);

    for(size_t i = 0; i < particleCount; ++i){
        NeighborListAtom& a = atoms[i];
        a.pos = positions[i];
        
        Point3 rp = simCell.absoluteToReduced(a.pos);
        for(size_t k = 0; k < 3; k++){
            if(simCell.pbcFlags()[k]){
                if(double s = floor(rp[k])){
                    rp[k] -= s;
                    a.pos -= s * simCell.matrix().column(k);
                }
            }
        }
        insertParticle(&a, rp, root, 0);
    }

    root->convertToAbsoluteCoordinates(simCell);
    return true;
}

// Allocates and initializes the per-thread PTM state needed by the C library
PTM::Kernel::Kernel(const PTM& algorithm) 
    : NeighborQuery(algorithm)
    , _algorithm(algorithm)
    , _structureType(StructureType::OTHER){
    _handle = ptm_initialize_local();
    _F.setZero();
}

// Cleans up the per-thread PTM state on destruction.
PTM::Kernel::~Kernel(){
    ptm_uninitialize_local(_handle);
}

// Convert the raw quaternion array returned by PTM into our Quaternion class
Quaternion PTM::Kernel::orientation() const{
    return Quaternion(
        _quaternion[1],
        _quaternion[2],
        _quaternion[3],
        _quaternion[0]
    );
}

struct ptmnbrdata_t{
    const PTM* neighFinder;
    const int* particleTypes;
    const std::vector<uint64_t>* cachedNeighbors;
};

static int getNeighbors(void* vdata, size_t, size_t atomIndex, int numRequested, ptm_atomicenv_t* env){
    auto* neighborData = static_cast<ptmnbrdata_t*>(vdata);
    const PTM* finder = neighborData->neighFinder;
    const int* particleTypes = neighborData->particleTypes;
    const auto& cachedNeighbors = *neighborData->cachedNeighbors;

    NearestNeighborFinder::Query<PTM::MAX_INPUT_NEIGHBORS> query(*finder);
    query.findNeighbors(atomIndex, false);
    const auto &results = query.results();

    int numNeighbors = std::min(numRequested - 1, static_cast<int>(results.size()));

    int dummy = 0;
    ptm_decode_correspondences(
        // FCC as default seed
        PTM_MATCH_FCC,
        // Mask generated in cacheNeighbors
        cachedNeighbors[atomIndex],
        env->correspondences,
        &dummy
    );

    // Central
    env->atom_indices[0] = static_cast<int>(atomIndex);
    env->points[0][0] = 0.0;
    env->points[0][1] = 0.0;
    env->points[0][2] = 0.0;

    // Neighbors by correpondences
    for(int i = 0; i < numNeighbors; ++i){
        int p = env->correspondences[i + 1] - 1;
        if(p < 0 || p >= static_cast<int>(results.size())) continue;
        const auto& nb = results[p];
        env->atom_indices[i + 1] = nb.index;
        env->points[i + 1][0] = nb.delta.x();
        env->points[i + 1][1] = nb.delta.y();
        env->points[i + 1][2] = nb.delta.z();
    }

    // Types
    if(particleTypes){
        env->numbers[0] = particleTypes[atomIndex];
        for(int i = 0; i < numNeighbors; ++i){
            int p = env->correspondences[i + 1] - 1;
            if(p < 0 || p >= static_cast<int>(results.size())) continue;
            env->numbers[i + 1] = particleTypes[results[p].index];
        }  
    }else{
        for(int i = 0; i < numNeighbors + 1; ++i) env->numbers[i] = 0;
    }

    env->num = numNeighbors + 1;
    return env->num;
}

StructureType PTM::Kernel::identifyStructure(size_t particleIndex, const std::vector<uint64_t>& cachedNeighbors, Quaternion*){
    findNeighbors(particleIndex, false); 
    ptmnbrdata_t nbrdata;
    nbrdata.neighFinder = &_algorithm; 
    nbrdata.particleTypes = _algorithm._identifyOrdering ? _algorithm._particleTypes : nullptr;
    nbrdata.cachedNeighbors = &cachedNeighbors;

    // TODO: Segmentation fault with ICO & SC & GRAPHENE
    int32_t flags = PTM_CHECK_SC | PTM_CHECK_FCC | PTM_CHECK_HCP | PTM_CHECK_BCC | PTM_CHECK_DCUB | PTM_CHECK_DHEX;

    ptm_result_t result;
    int errorCode = ptm_index(
        _handle, 
        particleIndex, 
        getNeighbors, 
        (void*)&nbrdata, 
        flags, 
        _algorithm._calculateDefGradient, 
        &result, 
        &_env
    );

    _orderingType = result.ordering_type;
    _scale = result.scale;
    _rmsd = result.rmsd;
    _interatomicDistance = result.interatomic_distance;
    _bestTemplateIndex = result.template_index;
    memcpy(_quaternion, result.orientation, 4 * sizeof(double));
    
    if(_algorithm._calculateDefGradient){
        memcpy(_F.elements(), result.F, 9 * sizeof(double));
    }

    // Apply cutoff with more lenient thresholds for diamond structures
    if(result.structure_type == PTM_MATCH_NONE || 
       (_algorithm._rmsdCutoff != 0 && _rmsd > _algorithm._rmsdCutoff)) {
        _structureType = StructureType::OTHER;
        _orderingType = static_cast<int32_t>(OrderingType::ORDERING_NONE);
        _rmsd = 0.0;
        _corrCode = 0;
        _interatomicDistance = 0.0;
        memset(_quaternion, 0, 4 * sizeof(double));
        _scale = 0.0;
        _bestTemplateIndex = 0;
        _F.setZero();
    }else{
        _structureType = ptmToStructureType(result.structure_type);
        int ptmType = PTM::toPtmStructureType(_structureType);

        _corrCode = ptm_encode_correspondences(
            ptmType,
            _env.num,
            _env.correspondences,
            _bestTemplateIndex
        );
    }
    
    return _structureType;
}

// Returns how many "template" neighbors (ideal lattice points) PTM will give us
int PTM::Kernel::numTemplateNeighbors() const{
    int ptmType = toPtmStructureType(_structureType);
    if(ptmType == PTM_MATCH_NONE) return 0;
    return ptm_num_nbrs[ptmType];
}

// Access the raw nearest-neighbor result in sorted distance order
const NearestNeighborFinder::Neighbor& PTM::Kernel::getNearestNeighbor(int index) const{
    //assert(index >= 0 && index < results().size());
    return results()[index];
}

// Access the i-th neighbor after PTM has reordered them to match the template.
const NearestNeighborFinder::Neighbor& PTM::Kernel::getTemplateNeighbor(int index) const{
    //assert(_structureType != StructureType::OTHER);
    //assert(index >= 0 && index < numTemplateNeighbors());
    int mappedIndex = _env.correspondences[index + 1] - 1;
    return getNearestNeighbor(mappedIndex);
}

}
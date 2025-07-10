#include <opendxa/analysis/polyhedral_template_matching.h>
#include <opendxa/math/affine_transformation.h>

#include <cassert>
#include <cstring> 
#include <cmath> 
#include <stdexcept>

namespace OpenDXA{

PTM::StructureType PTM::ptmToStructureType(int type){
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
        default: assert(false); return PTM_MATCH_NONE;
    }
}

PTM::PTM() : NearestNeighborFinder(MAX_INPUT_NEIGHBORS){
    ptm_initialize_global();
}

void PTM::setStructureTypeIdentification(StructureType structureType, bool enableIdentification){
    _typesToIdentify[static_cast<size_t>(structureType)] = enableIdentification;
}

bool PTM::isAnyStructureTypeEnabled() const{
    for(size_t i = 1; i < static_cast<size_t>(StructureType::NUM_STRUCTURE_TYPES); ++i){
        if(_typesToIdentify[i]) return true;
    }
    return false;
}

void PTM::setIdentifyOrdering(const int* particleTypes){
    _particleTypes = particleTypes;
    _identifyOrdering = (_particleTypes != nullptr);
}

int PTM::Kernel::cacheNeighbors(size_t particleIndex, uint64_t* res){
    assert(particleIndex < _algo.particleCount());
    
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

bool PTM::prepare(
    const Point3* positions,
    size_t particleCount,
    const SimulationCell& cellData
){
    assert(positions);
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

PTM::Kernel::Kernel(const PTM& algorithm) : NeighborQuery(algorithm), _algorithm(algorithm){
    _handle = ptm_initialize_local();
    _F.setZero();
}

PTM::Kernel::~Kernel(){
    ptm_uninitialize_local(_handle);
}

Quaternion PTM::Kernel::orientation() const{
    return Quaternion(
        _quaternion[1],
        _quaternion[2],
        _quaternion[3],
        _quaternion[0]
    );
}

struct ptmnbrdata_t{
    const BoundedPriorityQueue<NearestNeighborFinder::Neighbor, std::less<NearestNeighborFinder::Neighbor>, PTM::MAX_INPUT_NEIGHBORS>* neighborResults;
    const int* particleTypes;
    const std::vector<uint64_t>* cachedNeighbors;
    PTM::StructureType lastIdentifiedType;
};

static int getNeighbors(void* vdata, size_t, size_t atomIndex, int numRequested, ptm_atomicenv_t* env){
    auto* nbrdata = static_cast<ptmnbrdata_t*>(vdata);
    const auto &neighborResults = *nbrdata->neighborResults;
    const int *particleTypes = nbrdata->particleTypes;
    const std::vector<uint64_t>& cachedNeighbors = *nbrdata->cachedNeighbors;
    int numNeighbors = std::min(numRequested - 1, (int) neighborResults.size());
    assert(numNeighbors <= PTM::MAX_INPUT_NEIGHBORS);
    auto* d = static_cast<ptmnbrdata_t*>(vdata);
    int ptmType = PTM::toPtmStructureType(d->lastIdentifiedType);
    int bestTemplateIndex;
    ptm_decode_correspondences(
        ptmType,
        (*(d->cachedNeighbors))[atomIndex],
        env->correspondences,
        &bestTemplateIndex
    );
    env->atom_indices[0] = atomIndex;
    env->points[0][0] = 0;
    env->points[0][1] = 0;
    env->points[0][2] = 0;
    for(int i = 0; i < numNeighbors; i++){
        int p = env->correspondences[i + 1] - 1;
        assert(p >= 0 && p < neighborResults.size());
        env->atom_indices[i + 1] = neighborResults[p].index;
        env->points[i + 1][0] = neighborResults[p].delta.x();
        env->points[i + 1][1] = neighborResults[p].delta.y();
        env->points[i + 1][2] = neighborResults[p].delta.z();
    }

    if(particleTypes){
        env->numbers[0] = particleTypes[atomIndex];
        for(int i = 0; i < numNeighbors; i++){
            int p = env->correspondences[i + 1] - 1;
            env->numbers[i + 1] = particleTypes[neighborResults[p].index];
        }
    }else{
        std::fill(env->numbers, env->numbers + numNeighbors + 1, 0);
    }

    env->num = numNeighbors + 1;
    return numNeighbors + 1;
}

PTM::StructureType PTM::Kernel::identifyStructure(size_t particleIndex, const std::vector<uint64_t>& cachedNeighbors, Quaternion*){
    assert(cachedNeighbors.size() == _algorithm.particleCount());
    assert(particleIndex < _algorithm.particleCount());
    findNeighbors(particleIndex, false);
    ptmnbrdata_t nbrdata;
    nbrdata.neighborResults = &this->results();
    nbrdata.particleTypes = _algorithm._identifyOrdering ? _algorithm._particleTypes : nullptr;
    nbrdata.cachedNeighbors = &cachedNeighbors;
    nbrdata.lastIdentifiedType   = _structureType;
    int32_t flags = 0;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::SC)]) flags |= PTM_CHECK_SC;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::FCC)]) flags |= PTM_CHECK_FCC;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::HCP)]) flags |= PTM_CHECK_HCP;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::ICO)]) flags |= PTM_CHECK_ICO;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::BCC)]) flags |= PTM_CHECK_BCC;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::CUBIC_DIAMOND)]) flags |= PTM_CHECK_DCUB;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::HEX_DIAMOND)]) flags |= PTM_CHECK_DHEX;
    if (_algorithm._typesToIdentify[static_cast<size_t>(StructureType::GRAPHENE)]) flags |= PTM_CHECK_GRAPHENE;
    ptm_result_t result;
    int errorCode = ptm_index(_handle, particleIndex, getNeighbors, (void*) &nbrdata, flags, _algorithm._calculateDefGradient, &result, &_env);
    assert(errorCode == PTM_NO_ERROR);
    _orderingType = result.ordering_type;
    _scale = result.scale;
    _rmsd = result.rmsd;
    _interatomicDistance = result.interatomic_distance;
    _bestTemplateIndex = result.template_index;
    _bestTemplate = nullptr;
    memcpy(_quaternion, result.orientation, 4 * sizeof(double));
    if(_algorithm._calculateDefGradient){
        memcpy(_F.elements(), result.F, 9 * sizeof(double));
    }
    if(result.structure_type == PTM_MATCH_NONE || (_algorithm._rmsdCutoff != 0 && _rmsd > _algorithm._rmsdCutoff)){
        _structureType = StructureType::OTHER;
        _orderingType = static_cast<int32_t>(OrderingType::ORDERING_NONE);
        _rmsd = 0.0;
        _interatomicDistance = 0.0;
        memset(_quaternion, 0, 4 * sizeof(double));
        _scale = 0.0;
        _bestTemplateIndex = 0;
        _F.setZero();
    }else{
        _structureType = ptmToStructureType(result.structure_type);
    }
    return _structureType;
}

int PTM::Kernel::numTemplateNeighbors() const{
    int ptmType = toPtmStructureType(_structureType);
    if(ptmType == PTM_MATCH_NONE) return 0;
    return ptm_num_nbrs[ptmType];
}

const NearestNeighborFinder::Neighbor& PTM::Kernel::getNearestNeighbor(int index) const{
    assert(index >= 0 && index < results().size());
    return results()[index];
}

const NearestNeighborFinder::Neighbor& PTM::Kernel::getTemplateNeighbor(int index) const{
    assert(_structureType != StructureType::OTHER);
    assert(index >= 0 && index < numTemplateNeighbors());
    int mappedIndex = _env.correspondences[index + 1] - 1;
    return getNearestNeighbor(mappedIndex);
}

const Vector3& PTM::Kernel::getIdealNeighborVector(int index) const{
    assert(_structureType != StructureType::OTHER);
    assert(index >= 0 && index < numTemplateNeighbors());
    assert(_bestTemplate != nullptr);
    return *reinterpret_cast<const Vector3*>(_bestTemplate[index + 1]);
}

}
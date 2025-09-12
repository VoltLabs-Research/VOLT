#include <opendxa/analysis/ptm_neighbor_finder.h>

namespace OpenDXA{

inline StructureType readStructure(const Particles::ParticleProperty& property, size_t i){
    return static_cast<StructureType>(property.getInt(i));
}

inline Quaternion readOrientation(const Particles::ParticleProperty& property, size_t i){
    const auto* quat = reinterpret_cast<const Quaternion*>(property.constData());
    return quat[i];
}

inline uint64_t readCorrespondence(const Particles::ParticleProperty& property, size_t i){
    const auto* u = reinterpret_cast<const uint64_t*>(property.constData());
    return u[i];
}

// Computes the ordered list of neighbor particles
void PTMNeighborFinder::Query::findNeighbors(size_t particleIndex, std::optional<Quaternion> targetOrientation){
    _structureType = readStructure(*_finder._structuresArray, particleIndex);
    _orientation = readOrientation(*_finder._orientationsArray, particleIndex);
    _rmsd = std::numeric_limits<double>::infinity();

    int ptmType = PTM::toPtmStructureType(_structureType);
    getNeighbors(particleIndex, ptmType);

    std::array<int8_t, PTM_MAX_INPUT_POINTS> remap_permutation{};
    std::array<int, PTM_MAX_INPUT_POINTS> tmp{};
    std::iota(tmp.begin(), tmp.end(), 0);
    for(size_t i = 0; i < remap_permutation.size(); ++i){
        remap_permutation[i] = static_cast<int8_t>(tmp[i]);
    }

    if(_structureType != StructureType::OTHER && targetOrientation){
        // Arrange orientation in PTM format
        double qtarget[4] = {
            targetOrientation->w(),
            targetOrientation->x(),
            targetOrientation->y(),
            targetOrientation->z()
        };

        double qptm[4] = {
            _orientation.w(),
            _orientation.x(),
            _orientation.y(),
            _orientation.z()
        };

        _templateIndex = ptm_remap_template(ptmType, _templateIndex, qtarget, qptm, remap_permutation.data());

        _orientation.w() = qptm[0];
        _orientation.x() = qptm[1];
        _orientation.y() = qptm[2];
        _orientation.z() = qptm[3];
    }

    const double (*ptmTemplate)[3] = PTM::getTemplate(_structureType, _templateIndex);
    for(int i = 0; i < _list.size(); i++){
        Neighbor& n = _list[i];
        int index = remap_permutation[i + 1];
        n.index = _env.atom_indices[index];
        const double *p = _env.points[index];
        n.delta = Vector3(p[0], p[1], p[2]);
        n.distanceSq = n.delta.squaredLength();
        
        if(_structureType == StructureType::OTHER){
            n.idealVector = Vector_3<double>(0, 0, 0);
        }else{
            const double* q = ptmTemplate[i + 1];
            n.idealVector = Vector3(q[0], q[1], q[2]);
        }

        if(_structureType != StructureType::OTHER){
            const auto structType = readStructure(*_finder._structuresArray, n.index);
            const auto quatOrientation  = readOrientation(*_finder._orientationsArray, n.index);
            n.disorientation = PTM::calculateDisorientation(_structureType, structType, _orientation, quatOrientation);
        }else{
            n.disorientation = std::numeric_limits<double>::max();
        }
    }

    if(_structureType != StructureType::OTHER){
        calculateRMSDScale();
    }
}

void PTMNeighborFinder::Query::getNeighbors(size_t particleIndex, int ptmType){
    const auto& correspondencesArray = *_finder._correspondencesArray;

    // Let the internal NearestNeighborFinder determine the list of nearest particles
    NeighborQuery neighborQuery(_finder);
    neighborQuery.findNeighbors(particleIndex);

    int numNeighbors = static_cast<int>(neighborQuery.results().size());
    _templateIndex = 0;

    int numInner = ptm_num_nbrs[ptmType];
    int numOuter = 0;
    if(ptmType == PTM_MATCH_NONE){
        for(int i = 0; i < PTM_MAX_INPUT_POINTS; i++){
            _env.correspondences[i] = i;
        }

        numInner = numNeighbors;
    }else{
        numNeighbors = ptm_num_nbrs[ptmType];
        const uint64_t corr = readCorrespondence(*_finder._correspondencesArray, particleIndex);
        ptm_decode_correspondences(ptmType, corr, _env.correspondences, &_templateIndex);
    }

    _env.num = numNeighbors + 1;
    _list.resize(numNeighbors);

    if(ptmType == PTM_MATCH_DCUB || ptmType == PTM_MATCH_DHEX){
        numInner = 4;
        numOuter = 3;
    }else if(ptmType == PTM_MATCH_GRAPHENE){
        numInner = 3;
        numOuter = 2;
    }

    fillNeighbors(neighborQuery, particleIndex, 0, numInner, _env.points[0]);
    if(numOuter != 0){
        for(int i = 0; i < numInner; i++){
            neighborQuery.findNeighbors(_env.atom_indices[i + 1]);
            fillNeighbors(neighborQuery, _env.atom_indices[i + 1], numInner + i * numOuter, numOuter, _env.points[i + 1]);
        }
    }
}

void PTMNeighborFinder::Query::fillNeighbors(
    const NeighborQuery& neighborQuery,
    size_t particleIndex,
    int offset,
    int num,
    const double* delta
){
    int numNeighbors = neighborQuery.results().size();
    if(numNeighbors < num){
        return;
    }

    if(offset == 0){
        _env.atom_indices[0] = particleIndex;
        _env.points[0][0] = 0;
        _env.points[0][1] = 0;
        _env.points[0][2] = 0;
    }

    for(int i = 0; i < num; i++){
        int p = _env.correspondences[i + 1 + offset] - 1;
        _env.points[i + 1 + offset][0] = neighborQuery.results()[p].delta.x() + delta[0];
        _env.points[i + 1 + offset][1] = neighborQuery.results()[p].delta.y() + delta[1];
        _env.points[i + 1 + offset][2] = neighborQuery.results()[p].delta.z() + delta[2];
    }
}

void PTMNeighborFinder::Query::calculateRMSDScale(){
    // Get neighbor points
    boost::container::small_vector<Vector3, PTM_MAX_INPUT_POINTS> centered;
    boost::container::small_vector<Vector3, PTM_MAX_INPUT_POINTS> rotatedTemplate;
    centered.push_back(Vector3::Zero());
    rotatedTemplate.push_back(Vector3::Zero());
    Vector3 barycenter = Vector3::Zero();

    for(const Neighbor& nbr : _list){
        rotatedTemplate.push_back(_orientation * nbr.idealVector);
        centered.push_back(nbr.delta);
        barycenter += nbr.delta;
    }

    barycenter /= centered.size();
    for(Vector3& c : centered){
        c -= barycenter;
    }

    // Calculate scale
    // (s.a - b)^2 = s^2.a^2 - 2.s.a.b + b^2
    // d/ds (s^2.a^2 - 2.s.a.b + b^2) = 2.s.a^2 - 2.a.b
    // s.a^2 = a.b
    // s = a.b / (a.a)
    double numerator = 0, denominator = 0;
    for(int i = 0; i < centered.size(); i++){
        numerator += centered[i].dot(rotatedTemplate[i]);
        denominator += centered[i].squaredLength();
    }
    double scale = numerator / denominator;

    // Calculate interatomic distance
    _interatomicDistance = _list[1].idealVector.length() / scale;

    // Calculate RMSD
    _rmsd = 0;
    for(int i = 0; i < centered.size(); i++){
        auto delta = scale * centered[i] - rotatedTemplate[i];
        _rmsd += delta.squaredLength();
    }

    _rmsd = sqrt(_rmsd / centered.size());
}

}
#include <opendxa/analysis/cluster_connector.h>
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <tbb/parallel_reduce.h>
#include <execution>
#include <limits>
#include <cmath>

inline constexpr double CA_TRANSITION_MATRIX_EPSILON = 1e-6;

namespace OpenDXA{

ClusterConnector::ClusterConnector(
    StructureAnalysis& sa,
    AnalysisContext& context
) : _sa(sa), _context(context){
    _neighborMutexes = std::make_unique<tbb::spin_mutex[]>(1024);
}

void ClusterConnector::connectClusterNeighbors(int atomIndex, Cluster* cluster1){
    int structureType = _context.structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::getLatticeStruct(structureType);
    const CoordinationStructure& coordStructure = CoordinationStructures::getCoordStruct(structureType);
    int symPermIndex = _context.atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symPermIndex].permutation;

    const int nn = _sa.numberOfNeighbors(atomIndex); 
    for(int ni = 0; ni < nn; ++ni){
        int neighbor = _sa.getNeighbor(atomIndex, ni);
        if(neighbor < 0 || neighbor == atomIndex) continue;
        processNeighborConnection(atomIndex, neighbor, ni, cluster1, structureType);
    }
}

// Groups atoms with the same structure (FCC, BCC, HCP, etc.).
Cluster* ClusterConnector::startNewCluster(int atomIndex, int structureType){
    Cluster* cluster = _sa.clusterGraph().createCluster(structureType);
    assert(cluster->id > 0);
    
    cluster->atomCount = 1;
    _context.atomClusters->setInt(atomIndex, cluster->id);
     return cluster;
}

Matrix3 ClusterConnector::quaternionToMatrix(const Quaternion& q)  {
    double w = q.w(), x = q.x(), y = q.y(), z = q.z();
    Matrix3 R;
    R(0,0) = 1 - 2 * (y * y + z * z);
    R(0,1) = 2 * (x * y - w * z);
    R(0,2) = 2 * (x * z + w * y);
    R(1,0) = 2 * (x * y + w * z);
    R(1,1) = 1 - 2 * (x * x + z * z);
    R(1,2) = 2 * (y * z - w * x);
    R(2,0) = 2 * (x * z - w * y);
    R(2,1) = 2 * (y * z + w * x);
    R(2,2) = 1 - 2 * (x * x + y * y);
    return R;
}

Quaternion ClusterConnector::getPTMAtomOrientation(int atom) const{
    const double *qdata = _context.ptmOrientation->dataDouble() + atom * 4;
    Quaternion quat(qdata[0], qdata[1], qdata[2], qdata[3]);
    quat.normalize();
    return quat;
}

bool ClusterConnector::areOrientationsCompatible(int atom1, int atom2, int structureType){  
    Quaternion q1 = getPTMAtomOrientation(atom1);
    Quaternion q2 = getPTMAtomOrientation(atom2);
    Quaternion quatDiff = q1.inverse() * q2;
    
    float rmsd1 = _context.ptmRmsd->getDouble(atom1);
    float rmsd2 = _context.ptmRmsd->getDouble(atom2);
    float avgRmsd = (rmsd1 + rmsd2) * 0.5f;
    
    const LatticeStructure& latticeStructure = CoordinationStructures::getLatticeStruct(structureType);
    Matrix3 rotationMatrix = quaternionToMatrix(quatDiff);
    
    double thresholdAngle = 0.0;
    const double STRICT_THRESHOLD = 3.0 * M_PI / 180.0;
    const double RELAXED_THRESHOLD = 8.0 * M_PI / 180.0;

    // TODO: is this correct?
    if(structureType == StructureType::SC){
        thresholdAngle = RELAXED_THRESHOLD;
    } else if(avgRmsd < 0.1f){
        thresholdAngle = STRICT_THRESHOLD;
    } else {
        thresholdAngle = RELAXED_THRESHOLD;
    }

    double minTrace = 1.0 + 2.0 * std::cos(thresholdAngle);
    for(const auto &symmetryOp : latticeStructure.permutations){
        // Calculate deviation from symmetry: R_dev = R * S^T
        Matrix3 product = rotationMatrix * symmetryOp.transformation.transposed();
        if((product(0,0) + product(1,1) + product(2,2)) > minTrace){
            return true;
        }
    }

    return false;
}

bool ClusterConnector::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition){
    int structureType = _context.structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::getLatticeStruct(structureType);
    const CoordinationStructure& coordStructure = CoordinationStructures::getCoordStruct(structureType);
    int symIndex = _context.atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symIndex].permutation;

    // Special handling for Simple Cubic (SC) using PTM
    // SC neighbors do not share common first-shell neighbors, so the geometric method fails.
    if(structureType == StructureType::SC && _sa.usingPTM()){
        int neighborStructureType = _context.structureTypes->getInt(neighbor);
        if(neighborStructureType == StructureType::SC){
            const LatticeStructure& neighborLattice = CoordinationStructures::getLatticeStruct(neighborStructureType);
            int neighborSymIndex = _context.atomSymmetryPermutations->getInt(neighbor);
            
            // Get PTM orientations (Global from Template)
            Quaternion q1 = getPTMAtomOrientation(atomIndex);
            Quaternion q2 = getPTMAtomOrientation(neighbor);
            Matrix3 R1 = quaternionToMatrix(q1);
            Matrix3 R2 = quaternionToMatrix(q2);
            
            // Get Symmetry rotations (Permuted from Template)
            // L_perm = S * L_template
            // Global = R * L_template = R * S^T * L_perm
            Matrix3 S1 = latticeStructure.permutations[symIndex].transformation;
            Matrix3 S2 = neighborLattice.permutations[neighborSymIndex].transformation;
            
            // We want T such that L2_perm = T * L1_perm
            // Global = R1 * S1^T * L1_perm
            // Global = R2 * S2^T * L2_perm
            // => R1 * S1^T * L1_perm = R2 * S2^T * T * L1_perm
            // => T = (R2 * S2^T)^T * (R1 * S1^T)
            // => T = S2 * R2^T * R1 * S1^T
            
            outTransition = S2 * R2.transposed() * R1 * S1.transposed();
            return true;
        }
    }

    Matrix3 tm1, tm2;
    for (int i = 0; i < 3; i++){
        int ai;
        if(i != 2){
            int cnIdx = coordStructure.commonNeighbors[neighborIndex][i];
            if(cnIdx < 0) return false;
            
            ai = _sa.getNeighbor(atomIndex, cnIdx);
            tm1.column(i) = latticeStructure.latticeVectors[permutation[cnIdx]] -
                            latticeStructure.latticeVectors[permutation[neighborIndex]];
        }else{
            ai = atomIndex;
            tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
        }
        
        // Check neighbor counts
        if(_sa.numberOfNeighbors(neighbor) != coordStructure.numNeighbors) return false;
        
        int j = _sa.findNeighbor(neighbor, ai);
        if(j == -1) return false;

        int neighborStructureType = _context.structureTypes->getInt(neighbor);
        const LatticeStructure& neighborLattice = CoordinationStructures::getLatticeStruct(neighborStructureType);
        int neighborSymIndex = _context.atomSymmetryPermutations->getInt(neighbor);
        const auto& neighborPerm = neighborLattice.permutations[neighborSymIndex].permutation;

        tm2.column(i) = neighborLattice.latticeVectors[neighborPerm[j]];
    }

    if (std::abs(tm1.determinant()) < EPSILON) return false;
    Matrix3 tm1inv;
    if (!tm1.inverse(tm1inv)) return false;

    outTransition = tm2 * tm1inv;
    return true;
}

void ClusterConnector::createNewClusterTransition(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, Cluster* cluster2){
    Matrix3 transition;
    if(!calculateMisorientation(atomIndex, neighbor, neighborIndex, transition)) return;
    if(!transition.isOrthogonalMatrix()) return;
    if(!cluster1->findTransition(cluster2)){
        ClusterTransition* t = _sa.clusterGraph().createClusterTransition(cluster1, cluster2, transition);
        t->area++;
        t->reverse->area++;
    }
}

void ClusterConnector::addReverseNeighbor(int neighbor, int atomIndex){
    tbb::spin_mutex::scoped_lock lock(_neighborMutexes[neighbor & 1023]);
    int otherListCount = _sa.numberOfNeighbors(neighbor);
    if(otherListCount < _context.neighborLists->componentCount()){
        _context.neighborLists->setIntComponent(neighbor, otherListCount, atomIndex);
    }
}

void ClusterConnector::processNeighborConnection(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, int structureType){
    if (neighbor < 0 || static_cast<size_t>(neighbor) >= _context.atomCount()) return; 

    int neighborClusterId = _context.atomClusters->getInt(neighbor);
    if(neighborClusterId == 0){
        addReverseNeighbor(neighbor, atomIndex);
        return;
    }

    if(neighborClusterId == cluster1->id) return;

    Cluster* cluster2 = _sa.clusterGraph().findCluster(neighborClusterId);
    //assert(cluster2);

    if(ClusterTransition* existing = cluster1->findTransition(cluster2)){
        existing->area++;
        existing->reverse->area++;
        return;
    }

    createNewClusterTransition(atomIndex, neighbor, neighborIndex, cluster1, cluster2);
}

Cluster* ClusterConnector::getParentGrain(Cluster* c){
    if(!c->parentTransition) return c;

    ClusterTransition* parentT = c->parentTransition;
    Cluster* parent = parentT->cluster2;

    while(parent->parentTransition){
        parentT = _sa.clusterGraph().concatenateClusterTransitions(parentT, parent->parentTransition);
        parent = parent->parentTransition->cluster2;
    }

    c->parentTransition = parentT;
    return parent;
}

void ClusterConnector::connectClusters(){
    // Process atoms sequentially for deterministic cluster transition creation order
    for(size_t atomIndex = 0; atomIndex < _context.atomCount(); ++atomIndex){
        processAtomConnections(atomIndex);
    }
    spdlog::info("Number of cluster transitions: {}", _sa.clusterGraph().clusterTransitions().size());
}

void ClusterConnector::processAtomConnections(size_t atomIndex){
    int clusterId = _context.atomClusters->getInt(atomIndex);
    if(clusterId == 0) return;
    Cluster* cluster1 = _sa.clusterGraph().findCluster(clusterId);
    //assert(cluster1);
    connectClusterNeighbors(atomIndex, cluster1);
}

void ClusterConnector::processDefectClusters(){
    for(Cluster* cluster : _sa.clusterGraph().clusters()){
        if(!cluster || cluster->id == 0) continue;
        if(cluster->structure != _context.inputCrystalType){
            processDefectCluster(cluster);
        }
    }
}

void ClusterConnector::initializeClustersForSuperclusterFormation(){
    for(Cluster* cluster : _sa.clusterGraph().clusters()){
        if(!cluster || cluster->id == 0) continue;
        cluster->rank = 0;
        //assert(cluster->parentTransition == nullptr);
    }
}

ClusterTransition* ClusterConnector::buildParentTransition(ClusterTransition* transition, Cluster* parent1, Cluster* parent2){
    ClusterTransition* parentTransition = transition;
    
    if(parent2 != transition->cluster2){
        parentTransition = _sa.clusterGraph().concatenateClusterTransitions(parentTransition, transition->cluster2->parentTransition);
    }
    
    if(parent1 != transition->cluster1){
        parentTransition = _sa.clusterGraph().concatenateClusterTransitions(transition->cluster1->parentTransition->reverse, parentTransition);
    }
    
    return parentTransition;
}

std::pair<Cluster*, Cluster*> ClusterConnector::getParentGrains(ClusterTransition* transition){
    Cluster* parent1 = getParentGrain(transition->cluster1);
    Cluster* parent2 = getParentGrain(transition->cluster2);
    return {parent1, parent2};
}

void ClusterConnector::processDefectCluster(Cluster* defectCluster){
    for(ClusterTransition* t = defectCluster->transitions; t; t = t->next){
        if(t->cluster2->structure != _context.inputCrystalType || t->distance != 1) continue;
        for(ClusterTransition* t2 = t->next; t2; t2 = t2->next) {
            if(t2->cluster2->structure != _context.inputCrystalType || t2->distance != 1) continue;
            if(t2->cluster2 == t->cluster2) continue;

            const LatticeStructure& lattice = CoordinationStructures::getLatticeStruct(t2->cluster2->structure);
            Matrix3 misorientation = t2->tm * t->reverse->tm;

            for(const auto& sym : lattice.permutations){
                if(sym.transformation.equals(misorientation, CA_TRANSITION_MATRIX_EPSILON)){
                    _sa.clusterGraph().createClusterTransition(t->cluster2, t2->cluster2, misorientation, 2);
                    break;
                }
            }
        }
    }
}

void ClusterConnector::finalizeParentGrains(){
    for(Cluster* cluster : _sa.clusterGraph().clusters()){
        getParentGrain(cluster);
    }
}

void ClusterConnector::assignParentTransition(Cluster* parent1, Cluster* parent2, ClusterTransition* parentTransition){
    if(parent1->rank > parent2->rank){
        parent2->parentTransition = parentTransition->reverse;
        return;
    }

    parent1->parentTransition = parentTransition;
    
    if(parent1->rank == parent2->rank){
        parent2->rank++;
    }
}

void ClusterConnector::mergeCompatibleGrains(size_t oldTransitionCount, size_t newTransitionCount){
    for(size_t i = oldTransitionCount; i < newTransitionCount; i++){
        ClusterTransition* transition = _sa.clusterGraph().clusterTransitions()[i];
        // Validate transitions properties
        //assert(transition->distance == 2);
        //assert(transition->cluster1->structure == _context.inputCrystalType);
        //assert(transition->cluster2->structure == _context.inputCrystalType);
                
        auto [parent1, parent2] = getParentGrains(transition);
        if(parent1 == parent2) continue;
        
        ClusterTransition* parentTransition = buildParentTransition(transition, parent1, parent2);
        assignParentTransition(parent1, parent2, parentTransition);
    }
}

void ClusterConnector::formSuperClusters(){
    size_t oldTransitionCount = _sa.clusterGraph().clusterTransitions().size();
    
    initializeClustersForSuperclusterFormation();
    processDefectClusters();
    
    size_t newTransitionCount = _sa.clusterGraph().clusterTransitions().size();
    mergeCompatibleGrains(oldTransitionCount, newTransitionCount);
    
    finalizeParentGrains();
}

void ClusterConnector::initializePTMClusterOrientation(Cluster* cluster, size_t seedAtomIndex){
    double* qdat = _context.ptmOrientation->dataDouble() + seedAtomIndex * 4;
    Quaternion q(qdat[0], qdat[1], qdat[2], qdat[3]);
    q.normalize();
    
    // We save the orientations, that is, where the crystallographic X, Y, Z axis points.
    Vector3 ex(1.0, 0.0, 0.0), ey(0.0, 1.0, 0.0), ez(0.0, 0.0, 1.0);
    Matrix3 R;
    R.column(0) = q * ex;
    R.column(1) = q * ey;
    R.column(2) = q * ez;
    cluster->orientation = R;
}

void ClusterConnector::buildClustersForPTM(){
    const size_t N = _context.atomCount();
    
    for(size_t seedAtomIndex = 0; seedAtomIndex < N; ++seedAtomIndex){
        if(alreadyProcessedAtom(seedAtomIndex)) continue;

        int structureType = _context.structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        initializePTMClusterOrientation(cluster, seedAtomIndex);

        // Find the best symmetry permutation that matches the cluster's base orientation
        // We start with identity as the local symmetry for the seed atom
        cluster->symmetryTransformation = 0; 
        _context.atomSymmetryPermutations->setInt(seedAtomIndex, 0);

        std::deque<int> atomsToVisit{ int(seedAtomIndex) };
        growClusterPTM(cluster, atomsToVisit, structureType);
    }

    reorientAtomsToAlignClusters();
}

void ClusterConnector::growClusterPTM(Cluster* cluster, std::deque<int>& atomsToVisit, int structureType){
    while(!atomsToVisit.empty()){
        int currentAtom = atomsToVisit.front();
        atomsToVisit.pop_front();

        int numNeighbors = _sa.numberOfNeighbors(currentAtom);
        for(int ni = 0; ni < numNeighbors; ++ni){
            int neighbor = _sa.getNeighbor(currentAtom, ni);
            if(neighbor < 0 || neighbor == currentAtom) continue;
            if(_context.atomClusters->getInt(neighbor) != 0) continue;
            if(_context.structureTypes->getInt(neighbor) != structureType) continue;
            if(areOrientationsCompatible(currentAtom, neighbor, structureType)){
                _context.atomClusters->setInt(neighbor, cluster->id);
                cluster->atomCount++;

                // Find the local symmetry index k such that R_cluster * S_k approx R_neighbor
                Matrix3 R_cluster = cluster->orientation;
                Matrix3 R_neighbor = quaternionToMatrix(getPTMAtomOrientation(neighbor));
                Matrix3 localRotation = R_cluster.inverse() * R_neighbor;
                
                int symmetryIndex = _sa.findClosestSymmetryPermutation(structureType, localRotation);
                _context.atomSymmetryPermutations->setInt(neighbor, symmetryIndex);
                
                atomsToVisit.push_back(neighbor);
            }
        }
    }
}

void ClusterConnector::baseBuildClusters(){
    for(size_t seedAtomIndex = 0; seedAtomIndex < _context.atomCount(); seedAtomIndex++){
        if(alreadyProcessedAtom(seedAtomIndex)) continue;

        int structureType = _context.structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();
        std::deque<int> atomsToVisit(1, seedAtomIndex);

        growCluster(cluster, atomsToVisit, orientationV, orientationW, structureType);
        cluster->orientation = Matrix3(orientationW * orientationV.inverse());

        if(structureType == _context.inputCrystalType && !_context.preferredCrystalOrientations.empty()){
            applyPreferredOrientation(cluster);
        }
    }

    reorientAtomsToAlignClusters();
}

void ClusterConnector::growCluster(
    Cluster* cluster,
    std::deque<int>& atomsToVisit,
    Matrix_3<double>& orientationV,
    Matrix_3<double>& orientationW,
    int structureType
){
    const CoordinationStructure& coordStructure = CoordinationStructures::getCoordStruct(structureType);
    const LatticeStructure& latticeStructure = CoordinationStructures::getLatticeStruct(structureType);

    while(!atomsToVisit.empty()){
        int currentAtomIndex = atomsToVisit.front();
        atomsToVisit.pop_front();

        int symmetryPermutationIndex = _context.atomSymmetryPermutations->getInt(static_cast<size_t>(currentAtomIndex));
        const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

        for(int neighborIndex = 0; neighborIndex < coordStructure.numNeighbors; neighborIndex++){
            int neighborAtomIndex = _sa.getNeighbor(currentAtomIndex, neighborIndex);
            //assert(neighborAtomIndex != currentAtomIndex);

            const Vector3& latticeVector = latticeStructure.latticeVectors[permutation[neighborIndex]];
            const Vector3& spatialVector = _context.simCell.wrapVector(
                _context.positions->getPoint3(static_cast<size_t>(neighborAtomIndex)) - _context.positions->getPoint3(static_cast<size_t>(currentAtomIndex))
            );

            for(size_t i = 0; i < 3; i++){
                for(size_t j = 0; j < 3; j++){
                    orientationV(i, j) += (latticeVector[j] * latticeVector[i]);
                    orientationW(i, j) += (latticeVector[j] * spatialVector[i]);
                }
            }

            if(_context.atomClusters->getInt(neighborAtomIndex) != 0) continue;
            if(_context.structureTypes->getInt(neighborAtomIndex) != structureType) continue;

            Matrix3 tm1, tm2;
            bool properOverlap = true;

            for(int i = 0; i < 3; i++){
                int atomIndex;
                if(i != 2){
                    atomIndex = _sa.getNeighbor(currentAtomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
                    tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
                                    latticeStructure.latticeVectors[permutation[neighborIndex]];
                }else{
                    atomIndex = currentAtomIndex;
                    tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
                }

                //assert(numberOfNeighbors(neighborAtomIndex) == coordStructure.numNeighbors);
                int j = _sa.findNeighbor(neighborAtomIndex, atomIndex);
                if(j == -1){
                    properOverlap = false;
                    break;
                }
                tm2.column(i) = latticeStructure.latticeVectors[j];
            }

            if(!properOverlap) continue;

            //assert(std::abs(tm1.determinant()) > EPSILON);
            Matrix3 tm2inverse;
            if(!tm2.inverse(tm2inverse)) continue;

            Matrix3 transition = tm1 * tm2inverse;
            
            for(size_t i = 0; i < latticeStructure.permutations.size(); i++){
                if(transition.equals(latticeStructure.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
                    _context.atomClusters->setInt(neighborAtomIndex, cluster->id);
                    cluster->atomCount++;
                    _context.atomSymmetryPermutations->setInt(neighborAtomIndex, i);
                    atomsToVisit.push_back(neighborAtomIndex);
                    break;
                }
            }
        }
    }
}

void ClusterConnector::buildClusters(){
    if(_sa.usingPTM()){
       buildClustersForPTM();
    }else{
        baseBuildClusters();
    }

    spdlog::info("Number of clusters: {}", _sa.clusterGraph().clusters().size() - 1);
}

void ClusterConnector::applyPreferredOrientation(Cluster* cluster){
    const LatticeStructure& latticeStruct = CoordinationStructures::getLatticeStruct(cluster->structure);
    double smallestDeviation = std::numeric_limits<double>::max();
    Matrix3 oldOrientation = cluster->orientation;

    for(int symIndex = 0; symIndex < latticeStruct.permutations.size(); ++symIndex){
        const Matrix3& symMatrix = latticeStruct.permutations[symIndex].transformation;
        Matrix3 newOrientation = oldOrientation * symMatrix.inverse();
        double scaling = std::pow(std::abs(newOrientation.determinant()), 1.0 / 3.0);

        for(const auto& preferredOrientation : _context.preferredCrystalOrientations){
            double deviation = 0;
            for(size_t i = 0; i < 3; i++){
                for(size_t j = 0; j < 3; j++){
                    deviation += std::abs(newOrientation(i, j) / scaling - preferredOrientation(i, j));
                }
            }
            if(deviation < smallestDeviation){
                smallestDeviation = deviation;
                cluster->symmetryTransformation = symIndex;
                cluster->orientation = newOrientation;
            }
        }
    }
}

void ClusterConnector::reorientAtomsToAlignClusters(){
    tbb::parallel_for(tbb::blocked_range<size_t>(0, _context.atomCount()),
        [this](const tbb::blocked_range<size_t>& r) {
            for(size_t atomIndex = r.begin(); atomIndex != r.end(); ++atomIndex){
                int clusterId = _context.atomClusters->getInt(atomIndex);
                if(clusterId == 0) continue;

                Cluster* cluster = _sa.clusterGraph().findCluster(clusterId);
                assert(cluster);
                if(cluster->symmetryTransformation == 0) continue;

                const LatticeStructure& latticeStruct = CoordinationStructures::getLatticeStruct(cluster->structure);
                int oldSymmetry = _context.atomSymmetryPermutations->getInt(atomIndex);
                int newSymmetry = latticeStruct.permutations[oldSymmetry].inverseProduct[cluster->symmetryTransformation];
                _context.atomSymmetryPermutations->setInt(atomIndex, newSymmetry);
            }
        }
    );
}

bool ClusterConnector::alreadyProcessedAtom(int index){
    return _context.atomClusters->getInt(index) != 0 || _context.structureTypes->getInt(index) == StructureType::OTHER;
}

}
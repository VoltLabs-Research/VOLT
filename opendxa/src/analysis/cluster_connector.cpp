#include <opendxa/analysis/cluster_connector.h>
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <tbb/parallel_reduce.h>
#include <execution>

namespace OpenDXA{

ClusterConnector::ClusterConnector(
    StructureAnalysis& sa,
    AnalysisContext& context
) : _sa(sa), _context(context){}

void ClusterConnector::connectClusterNeighbors(int atomIndex, Cluster* cluster1){
    int structureType = _context.structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
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
    _context.atomSymmetryPermutations->setInt(atomIndex, 0);
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
    const double *qdata = _context.ptmOrientation->dataFloat() + atom * 4;
    Quaternion quat(qdata[0], qdata[1], qdata[2], qdata[3]);
    return quat;
}

Matrix3 orthogonalizeMatrix(const Matrix3& matrix){
    Matrix3 result = matrix;
    Vector3 col0 = result.column(0);
    Vector3 col1 = result.column(1);
    Vector3 col2 = result.column(2);

    double len0 = std::sqrt(
        col0.x() * col0.x() +
        col0.y() * col0.y() +
        col0.z() * col0.z()
    );

    if(len0 > 1e-12) col0 = col0 / len0;

    double dot01 = col0.x() * col1.x() + col0.y() * col1.y() + col0.z() * col1.z();

    col1 = col1 - col0 * dot01;

    double len1 = std::sqrt(
        col1.x() * col1.x() + 
        col1.y() * col1.y() + 
        col1.z() * col1.z()
    );

    if(len1 > 1e-12) col1 = col1 / len1;
    col2 = Vector3(
        col0.y() * col1.z() - col0.z() * col1.y(),
        col0.z() * col1.x() - col0.x() * col1.z(),
        col0.x() * col1.y() - col0.y() * col1.x()
    );

    result.column(0) = col0;
    result.column(1) = col1;
    result.column(2) = col2;
    
    return result;
}

bool ClusterConnector::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition){
    int structureType = _context.structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symIndex = _context.atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symIndex].permutation;

    Matrix3 tm1, tm2;
    for (int i = 0; i < 3; i++){
        int ai;
        if(i != 2){
            ai = _sa.getNeighbor(atomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
            tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
                            latticeStructure.latticeVectors[permutation[neighborIndex]];
        }else{
            ai = atomIndex;
            tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
        }

        if(_sa.numberOfNeighbors(neighbor) != coordStructure.numNeighbors) return false;
        int j = _sa.findNeighbor(neighbor, ai);
        if(j == -1) return false;

        int neighborStructureType = _context.structureTypes->getInt(neighbor);
        const LatticeStructure& neighborLattice = CoordinationStructures::_latticeStructures[neighborStructureType];
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
    for(size_t atomIndex = 0; atomIndex < _context.atomCount(); ++atomIndex){
        processAtomConnections(atomIndex);
    }
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

            const LatticeStructure& lattice = CoordinationStructures::latticeStructure(t2->cluster2->structure);
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

void ClusterConnector::buildClusters(){
    const size_t N = _context.atomCount();

    size_t totalProcessedAtoms = 0;
    size_t rejectedByDeformation = 0;
    size_t rejectedByOrientation = 0;
    size_t rejectedByGeometry = 0;
    size_t acceptedConnections = 0;

    // Iterate over atoms, looking for those that have not been visited yet
    for(size_t seedAtomIndex = 0; seedAtomIndex < N; seedAtomIndex++){
        if(_context.atomClusters->getInt(seedAtomIndex) != 0){
            continue;
        }
        
        int structureType = _context.structureTypes->getInt(seedAtomIndex);
        if(structureType == COORD_OTHER){
            continue;
        }

        // Start a new cluster
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        // For calculating the cluster orientation (if using CNA)
        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();

        // Add neighboring atoms to the cluster
        std::deque<int> atomsToVisit{ int(seedAtomIndex) };
        const auto& coordStruct = CoordinationStructures::_coordinationStructures[structureType];
        const auto& latticeStruct = CoordinationStructures::_latticeStructures[structureType];

        while(!atomsToVisit.empty()){
            int currentAtomIdx = atomsToVisit.front();
            atomsToVisit.pop_front();
            totalProcessedAtoms++;

            // Look up symmetry permutation of current atom
            int symmetryPermutationIdx = _context.atomSymmetryPermutations->getInt(static_cast<size_t>(currentAtomIdx));
            const auto& permutation = latticeStruct.permutations[symmetryPermutationIdx].permutation;
            
            // Visit neighbors of the current atom
            for(int neighborIdx = 0; neighborIdx < coordStruct.numNeighbors; neighborIdx++){
                // An atom should not be a neighbor of itself
                // We use the minimum image convention for simulation cells with periodic boundary conditions
                int neighborAtomIdx = _sa.getNeighbor(currentAtomIdx, neighborIdx);
                assert(neighborAtomIdx != currentAtomIdx);

                // Skip neighbors which are already part of the cluster, or which 
                // have a different coordination structure type
                if(neighborAtomIdx < 0 || neighborAtomIdx == currentAtomIdx) continue;
                if(_context.atomClusters->getInt(neighborAtomIdx) != 0) continue;
                if(_context.structureTypes->getInt(neighborAtomIdx) != structureType) continue;

                if(!_sa.usingPTM()){
                    // Add vector pair to matrices for computing the cluster orientation
                    const auto& latticeVector = latticeStruct.latticeVectors[permutation[neighborIdx]];
                    const auto& spatialVector = _context.simCell.wrapVector(
                        _context.positions->getPoint3(static_cast<size_t>(neighborAtomIdx)) - 
                        _context.positions->getPoint3(static_cast<size_t>(currentAtomIdx))
                    );

                    for(size_t i = 0; i < 3; i++){
                        for(size_t j = 0; j < 3; j++){
                            orientationV(i, j) += (latticeVector[j] * latticeVector[i]);
                            orientationW(i, j) += (latticeVector[j] * spatialVector[i]);
                        }
                    }
                }
        
                // Select three non-coplanar atoms, which are all neighbors of the current neighbor.
                // One of them is the current central atom, two are common neighbors.
                Matrix3 tm1, tm2;
                bool properOverlap = true;

                for(int i = 0; i < 3; i++){
                    int atomIdx;

                    if(i != 2){
                        atomIdx = _sa.getNeighbor(
                            currentAtomIdx,
                            coordStruct.commonNeighbors[neighborIdx][i]
                        );
                        tm1.column(i) = latticeStruct.latticeVectors[permutation[coordStruct.commonNeighbors[neighborIdx][i]]] -
                                        latticeStruct.latticeVectors[permutation[neighborIdx]];
                    }else{
                        atomIdx = currentAtomIdx;
                        tm1.column(i) = -(latticeStruct.latticeVectors[permutation[neighborIdx]]);
                    }

                    //assert(_sa.numberOfNeighbors(neighborAtomIdx) == coordStruct.numNeighbors);
                    int j = _sa.findNeighbor(neighborAtomIdx, atomIdx);
                    if(j == -1){
                        properOverlap = false;
                        break;
                    }

                    tm2.column(i) = latticeStruct.latticeVectors[j];
                }

                if(!properOverlap){
                    rejectedByGeometry++;
                    continue;
                }

                // Determine the misorientation matrix
                assert(std::abs(tm1.determinant()) > EPSILON);

                Matrix3 tm2inverse;
                if(!tm2.inverse(tm2inverse)) continue;

                Matrix3 transition = tm1 * tm2inverse;

                bool shouldAddToCluster = false;
                size_t bestPermutation = 0;

                if(_sa.usingPTM()){
                    // Check deformation
                    const double* currentF = _context.ptmDeformationGradient->dataFloat() + currentAtomIdx * 9;
                    const double* neighborF = _context.ptmDeformationGradient->dataFloat() + neighborAtomIdx * 9;

                    Matrix3 F1(currentF);
                    Matrix3 F2(neighborF);

                    double det1 = F1.determinant();
                    double det2 = F2.determinant();
                    double volumeStrainDiff = std::abs(det1 - det2) / std::max(std::abs(det1), std::abs(det2));

                    Matrix3 strain1 = 0.5 * (F1.transposed() * F1 - Matrix3::Identity());
                    Matrix3 strain2 = 0.5 * (F2.transposed() * F2 - Matrix3::Identity());
                    double strainDifference = (strain1 - strain2).frobeniusNorm();
                    
                    const double VOLUME_STRAIN_TOLERANCE = 0.05;
                    const double STRAIN_DIFF_TOLERANCE = 0.08;

                    bool deformationCompatible = (volumeStrainDiff < VOLUME_STRAIN_TOLERANCE && strainDifference < STRAIN_DIFF_TOLERANCE);
                    if(!deformationCompatible){
                        rejectedByDeformation++;
                        continue;
                    }

                    // Check orientation
                    double* currentQ = _context.ptmOrientation->dataFloat() + currentAtomIdx * 4;
                    double* neighborQ = _context.ptmOrientation->dataFloat() + neighborAtomIdx * 4;
                    
                    Quaternion q1(currentQ[0], currentQ[1], currentQ[2], currentQ[3]);
                    Quaternion q2(neighborQ[0], neighborQ[1], neighborQ[2], neighborQ[3]);
                    q1.normalize();
                    q2.normalize();

                    Quaternion quatDiff = q2 * q1.inverse();
                    double angle = 2.0 * std::acos(std::abs(quatDiff.w()));

                    const double PTM_ANGLE_THRESHOLD = (8.0 * M_PI) / 180.0;
                    if(angle < PTM_ANGLE_THRESHOLD){
                        // TODO: NOT PROVIDED FROM PTM?
                        // Finding the best permutation using the geometric method
                        for(size_t i = 0; i < latticeStruct.permutations.size(); i++){
                            if(transition.equals(latticeStruct.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
                                shouldAddToCluster = true;
                                bestPermutation = i;
                                break;
                            }
                        }

                        if(!shouldAddToCluster){
                            rejectedByGeometry++;
                        }
                    }else{
                        rejectedByOrientation++;
                    }
                }else{
                    // CNA
                    for(size_t i = 0; i < latticeStruct.permutations.size(); i++){
                        if(transition.equals(latticeStruct.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
                            shouldAddToCluster = true;
                            bestPermutation = i;
                            break;
                        }
                    }
                }

                if(shouldAddToCluster){
                    _context.atomClusters->setInt(neighborAtomIdx, cluster->id);
                    cluster->atomCount++;
                    _context.atomSymmetryPermutations->setInt(neighborAtomIdx, bestPermutation);
                    atomsToVisit.push_back(neighborAtomIdx);
                    acceptedConnections++;
                }
            }
        }

        // Compute matrix which transforms vectors from lattice space to simulation coordinates
        if(_sa.usingPTM()){
            double* qdata = _context.ptmOrientation->dataFloat() + seedAtomIndex * 4;
            Quaternion q(qdata[0], qdata[1], qdata[2], qdata[3]);
            q.normalize();

            Vector3 ex(1.0, 0.0, 0.0);
            Vector3 ey(0.0, 1.0, 0.0);
            Vector3 ez(0.0, 0.0, 1.0);
            Matrix3 R;
            R.column(0) = q * ex;
            R.column(1) = q * ey;
            R.column(2) = q * ez;
            
            cluster->orientation = R;
        }else{
            // TODO: CHECK canInvert?
            Matrix_3<double> orientationVInverse;
            bool canInvert = orientationV.inverse(orientationVInverse);

            if(canInvert && std::abs(orientationV.determinant()) > EPSILON){
                cluster->orientation = Matrix3(orientationW * orientationVInverse);
            }else{
                cluster->orientation = Matrix3::Identity();
            }
        }

        // Determine the symmetry permutation that leads to the best cluster orientation.
        // The best cluster orientation is the one that forms the smallest angle with
        // one of the preferred crystal orientations.
        if(structureType == _context.inputCrystalType && !_context.preferredCrystalOrientations.empty()){
            applyPreferredOrientation(cluster);
        }
    }

    // Hierarchical clustering for merger clusters supported only for PTM
    if(_sa.usingPTM()){
        spdlog::info("Starting post-processing cluster merging...");

        std::vector<Cluster*> clusters;
        for(Cluster* cluster : _sa.clusterGraph().clusters()){
            if(cluster && cluster->id != 0 && cluster->structure == _context.inputCrystalType){
                clusters.push_back(cluster);
            }
        }

        size_t mergedPairs = 0;
        const double CLUSTER_MERGE_ANGLE_THRESHOLD = (8.0 * M_PI )/ 180.0;

        // Find compatible clusters to merge
        for(size_t i = 0; i < clusters.size(); i++){
            // Only consider small clusters for merge
            if(clusters[i]->atomCount < 50) continue;

            for(size_t j = i + 1; j < clusters.size(); j++){
                if(clusters[j]->atomCount < 50) continue;

                // Check if clusters have existing transitions (are neighbors)
                bool areNeighbors = false;
                for(ClusterTransition* t = clusters[i]->transitions; t; t = t->next){
                    if(t->cluster2 == clusters[j]){
                        areNeighbors = true;
                        break;
                    }
                }

                if(!areNeighbors) continue;

                // Check orientation compatibility
                Matrix3 orientation1 = clusters[i]->orientation;
                Matrix3 orientation2 = clusters[j]->orientation;
                Matrix3 relativeOrientation = orientation2 * orientation1.inverse();

                // Calculate rotation angle using trace
                double trace = relativeOrientation(0,0) + relativeOrientation(1,1) + relativeOrientation(2,2);
                double angle = std::acos(std::max(-1.0, std::min(1.0, (trace - 1.0) / 2.0)));

                if(angle < CLUSTER_MERGE_ANGLE_THRESHOLD){
                    // Merger cluster j into cluster i
                    const size_t N = _context.atomCount();
                    for(size_t atomIdx = 0; atomIdx < N; atomIdx++){
                        if(_context.atomClusters->getInt(atomIdx) == clusters[j]->id){
                            _context.atomClusters->setInt(atomIdx, clusters[i]->id);
                        }      
                    }

                    clusters[i]->atomCount += clusters[j]->atomCount;
                    clusters[j]->atomCount = 0;
                    mergedPairs++;
                }
            }
        }

        spdlog::info("Post-processing merged {} cluster pairs", mergedPairs);
    }
    
    // Reorient atoms to align clusters with global coordinate system
    reorientAtomsToAlignClusters();

    if(_sa.usingPTM()){
        size_t finalClusterCount = 0;
        for(Cluster* cluster : _sa.clusterGraph().clusters()){
            if(cluster && cluster->id != 0 && cluster->atomCount > 0){
                finalClusterCount++;
            }
        }
        
        spdlog::info("PTM Clustering Statistics:");
        spdlog::info("  Total atoms processed: {}", totalProcessedAtoms);
        spdlog::info("  Accepted connections: {}", acceptedConnections);
        spdlog::info("  Rejected by deformation: {}", rejectedByDeformation);
        spdlog::info("  Rejected by orientation: {}", rejectedByOrientation);
        spdlog::info("  Rejected by geometry: {}", rejectedByGeometry);
        spdlog::info("  Final active clusters: {}", finalClusterCount);
        
        double rejectionRate = (double)(rejectedByDeformation + rejectedByOrientation + rejectedByGeometry) 
                              / (double)(acceptedConnections + rejectedByDeformation + rejectedByOrientation + rejectedByGeometry) * 100.0;
        spdlog::info("  Total rejection rate: {:.1f}%", rejectionRate);
    }

    spdlog::debug("Number of clusters: {}", _sa.clusterGraph().clusters().size() - 1);
}

void ClusterConnector::applyPreferredOrientation(Cluster* cluster) {
    const auto& latticeStruct = CoordinationStructures::_latticeStructures[cluster->structure];
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

                const auto& latticeStruct = CoordinationStructures::_latticeStructures[cluster->structure];
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
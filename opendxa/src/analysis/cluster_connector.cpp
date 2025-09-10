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
    // Look up symmetry permutation of the current atom.
    int structureType = _context.structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symPermIndex = _context.atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symPermIndex].permutation;

    // Visit neighbors of the current atom
    const int nn = _sa.numberOfNeighbors(atomIndex); 
    for(int ni = 0; ni < nn; ++ni){
        int neighbor = _sa.getNeighbor(atomIndex, ni);
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

bool ClusterConnector::areOrientationsCompatible(int atom1, int atom2, int structureType){  
    Quaternion q1 = getPTMAtomOrientation(atom1);
    Quaternion q2 = getPTMAtomOrientation(atom2);
    Quaternion quatDiff = q1.inverse() * q2;
    
    float rmsd1 = _context.ptmRmsd->getFloat(atom1);
    float rmsd2 = _context.ptmRmsd->getFloat(atom2);
    float avgRmsd = (rmsd1 + rmsd2) * 0.5f;
    
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    Matrix3 rotationMatrix = quaternionToMatrix(quatDiff);
    
    if(avgRmsd < 0.1f){
        for(const auto& symmetryOp : latticeStructure.permutations){
            if(rotationMatrix.equals(symmetryOp.transformation, CA_TRANSITION_MATRIX_EPSILON)){
                return true;
            }
        }
        
        double angle = 2.0 * std::acos(std::abs(quatDiff.w()));
        const double STRICT_THRESHOLD = 3.0 * M_PI / 180.0; 

        return angle < STRICT_THRESHOLD;
    }
    
    double angle = 2.0 * std::acos(std::abs(quatDiff.w()));
    const double RELAXED_THRESHOLD = 8.0 * M_PI / 180.0; 
    return angle < RELAXED_THRESHOLD;
}

bool ClusterConnector::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition){
    // TODO: Duplicate code!
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
    spdlog::info("Number of cluster transitions: {}", _sa.clusterGraph().clusterTransitions().size());
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
    // if(neighbor < 0 || static_cast<size_t>(neighbor) >= _context.atomCount()) return; 

    // Skip neighbor atoms belonging to the same cluster or to no cluster at all
    int neighborClusterId = _context.atomClusters->getInt(neighbor);
    if(neighborClusterId == 0 || neighborClusterId == cluster1->id){
        // Add this atom to the neighbors's list of neighbors
        addReverseNeighbor(neighbor, atomIndex);
        return;
    }

    Cluster* cluster2 = _sa.clusterGraph().findCluster(neighborClusterId);
    assert(cluster2);

    // Skip if there is already a transition between the two clusters
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

// Determines the transition matrices between clusters
void ClusterConnector::connectClusters(){
    auto indices = std::views::iota(size_t{0}, _context.atomCount());
    std::for_each(std::execution::par, indices.begin(), indices.end(), [this](size_t atomIndex){
        processAtomConnections(atomIndex);
    });
}

void ClusterConnector::processAtomConnections(size_t atomIndex){
    int clusterId = _context.atomClusters->getInt(atomIndex);
    if(clusterId == 0) return;
    Cluster* cluster1 = _sa.clusterGraph().findCluster(clusterId);
    assert(cluster1);
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
    // Create transition between lattice clusters on both sides of the defect
    for(ClusterTransition* t = defectCluster->transitions; t; t = t->next){
        if(t->cluster2->structure != _context.inputCrystalType || t->distance != 1) continue;
        for(ClusterTransition* t2 = t->next; t2; t2 = t2->next){
            if(t2->cluster2->structure != _context.inputCrystalType || t2->distance != 1) continue;
            if(t2->cluster2 == t->cluster2) continue;

            // Check if the two clusters form a single crystal
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
    // Merge crystal-crystal pairs
    for(size_t i = oldTransitionCount; i < newTransitionCount; i++){
        ClusterTransition* transition = _sa.clusterGraph().clusterTransitions()[i];
        // Validate transitions properties
        assert(transition->distance == 2);
        assert(transition->cluster1->structure == _context.inputCrystalType);
        assert(transition->cluster2->structure == _context.inputCrystalType);
                
        auto [parent1, parent2] = getParentGrains(transition);
        if(parent1 == parent2) continue;
        
        ClusterTransition* parentTransition = buildParentTransition(transition, parent1, parent2);
        assignParentTransition(parent1, parent2, parentTransition);
    }
}

// Combines clusters to super clusters
void ClusterConnector::formSuperClusters(){
    size_t oldTransitionCount = _sa.clusterGraph().clusterTransitions().size();
    
    for(Cluster* cluster : _sa.clusterGraph().clusters()){
        if(!cluster || cluster->id == 0) continue;
        cluster->rank = 0;
        assert(cluster->parentTransition == nullptr);
    }

    processDefectClusters();

    size_t newTransitionCount = _sa.clusterGraph().clusterTransitions().size();
    mergeCompatibleGrains(oldTransitionCount, newTransitionCount);
    
    finalizeParentGrains();
}

void ClusterConnector::initializePTMClusterOrientation(Cluster* cluster, size_t seedAtomIndex){
    double* qdat = _context.ptmOrientation->dataFloat() + seedAtomIndex * 4;
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
                atomsToVisit.push_back(neighbor);
            }
        }
    }
}

void ClusterConnector::baseBuildClusters(){
    // Iterate over atoms, looking for those that have not been visited yet
    for(size_t seedAtomIndex = 0; seedAtomIndex < _context.atomCount(); seedAtomIndex++){
        if(alreadyProcessedAtom(seedAtomIndex)) continue;

        // Start a new cluster
        int structureType = _context.structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        // For calculating the cluster orientation
        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();

        // Add neighboring atoms to the cluster
        std::deque<int> atomsToVisit(1, seedAtomIndex);
        growCluster(cluster, atomsToVisit, orientationV, orientationW, structureType);

        // Compute matrix, which transforms vectors from lattice space to simulation coordinates
        cluster->orientation = Matrix3(orientationW * orientationV.inverse());

        if(structureType == _context.inputCrystalType && !_context.preferredCrystalOrientations.empty()){
            // Determine the symmetry permutation that leads to the best cluster orientation.
            // The best cluster orientation is the one that forms the smallest angle with one
            // of the preferred crystal orientations
            applyPreferredOrientation(cluster);
        }
    }

    // Reorient atoms to align clusters with global coordinate system.
    reorientAtomsToAlignClusters();

    spdlog::debug("Number of clusters: {}", _sa.clusterGraph().clusters().size());
}

void ClusterConnector::growCluster(
    Cluster* cluster,
    std::deque<int>& atomsToVisit,
    Matrix_3<double>& orientationV,
    Matrix_3<double>& orientationW,
    int structureType
){
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];

    while(!atomsToVisit.empty()){
        int currentAtomIndex = atomsToVisit.front();
        atomsToVisit.pop_front();

        // Look up symmetry permutation of current atom
        int symmetryPermutationIndex = _context.atomSymmetryPermutations->getInt(static_cast<size_t>(currentAtomIndex));
        const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

        // Visit neighbors of current atom
        for(int neighborIndex = 0; neighborIndex < coordStructure.numNeighbors; neighborIndex++){
            // An atom should not be a neighbor of itself.
            // Minimum image convention for simulation cells with periodic boundary conditions.
            int neighborAtomIndex = _sa.getNeighbor(currentAtomIndex, neighborIndex);
            //assert(neighborAtomIndex != currentAtomIndex);

            // Add vector pair to matrices for computing the cluster orientation
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

            // Skip neighbors which are already part of the cluster, or 
            // which have a different coordination structure type.
            if(_context.atomClusters->getInt(neighborAtomIndex) != 0) continue;
            if(_context.structureTypes->getInt(neighborAtomIndex) != structureType) continue;

            // Select three non-coplanar atoms, which are all neighbors of the current neighbor.
            // One of them is the current central atom, two are common neighbors.
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

            // Determine the misorientation matrix
            assert(std::abs(tm1.determinant()) > EPSILON);
            Matrix3 tm2inverse;
            if(!tm2.inverse(tm2inverse)) continue;

            Matrix3 transition = tm1 * tm2inverse;

            if(latticeStructure.permutations.empty()) continue;
            if(_sa.usingPTM()){
                const double *q = _context.ptmOrientation->dataFloat() + 4 * neighborAtomIndex;
                Quaternion quat(q[0], q[1], q[2], q[3]); 
                Matrix3 R;
                Vector3 ex(1,0,0), ey(0,1,0), ez(0,0,1);
                R.column(0) = quat * ex; 
                R.column(1) = quat * ey; 
                R.column(2) = quat * ez;
                
                double best = 1e9;
                int bestIdx = 0;
                Matrix3 Rt = R.transposed();
                for(int i = 0; i < (int)latticeStructure.permutations.size(); ++i){
                    const Matrix3& S = latticeStructure.permutations[i].transformation;
                    Matrix3 Rrel = Rt * S * R;
                    double tr = Rrel(0, 0) + Rrel(1, 1) + Rrel(2, 2);
                    double c = std::max(-1.0, std::min(1.0, (tr - 1.0) * 0.5));
                    double angle = std::acos(c);
                    if(angle < best){
                        best = angle;
                        bestIdx = i;
                    }
                }

                _context.atomSymmetryPermutations->setInt(neighborAtomIndex, bestIdx);
            }else{
                // Find the corresponding symmetry permutation
                for(size_t i = 0; i < latticeStructure.permutations.size(); i++){
                    if(transition.equals(latticeStructure.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
                        // Make the neighbor atom part of the current cluster
                        _context.atomClusters->setInt(neighborAtomIndex, cluster->id);
                        cluster->atomCount++;
                        // Save the permutation index
                        _context.atomSymmetryPermutations->setInt(neighborAtomIndex, i);
                        // Recursively continue with the neighbor
                        atomsToVisit.push_back(neighborAtomIndex);
                        break;
                    }
                }
            }
        }
    }
}

// Combines adjacent atoms to clusters
void ClusterConnector::buildClusters(){
    baseBuildClusters();

    if(_sa.usingPTM()){
        buildClustersForPTM();
        return;
    }
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
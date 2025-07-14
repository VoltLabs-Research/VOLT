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
    ParticleProperty* positions, 
    const SimulationCell& simCell,
    LatticeStructureType inputCrystalType, 
    ParticleProperty* particleSelection,
    ParticleProperty* outputStructures, 
    std::vector<Matrix3>&& preferredCrystalOrientations,
    bool identifyPlanarDefects, 
    Mode _identificationMode
) :
    _positions(positions), _simCell(simCell),
    _inputCrystalType(inputCrystalType),
    _identificationMode(_identificationMode),
    _structureTypes(outputStructures),
    _particleSelection(particleSelection),
    _coordStructures(outputStructures, inputCrystalType, identifyPlanarDefects, simCell),
    _atomClusters(std::make_unique<ParticleProperty>(positions->size(), DataType::Int, 1, 0, true)),
    _atomSymmetryPermutations(std::make_unique<ParticleProperty>(positions->size(), DataType::Int, 1, 0, false)),
    _clusterGraph(std::make_unique<ClusterGraph>()),
    _preferredCrystalOrientations(std::move(preferredCrystalOrientations))
{
    static std::once_flag init_flag;
    std::call_once(init_flag, []() {
        CoordinationStructures::initializeStructures();
    });

    if(usingPTM()){
        _neighborLists = std::make_shared<ParticleProperty>(positions->size(), DataType::Int, PTM_MAX_NBRS, 0, false);
    }else{
        _neighborLists = std::make_shared<ParticleProperty>(positions->size(), DataType::Int,
            _coordStructures.latticeStructure(inputCrystalType).maxNeighbors, 0, false);
    }

    std::fill(_neighborLists->dataInt(), _neighborLists->dataInt() + _neighborLists->size() * _neighborLists->componentCount(), -1);
    std::fill(_structureTypes->dataInt(), _structureTypes->dataInt() + _structureTypes->size(), LATTICE_OTHER);
}

std::pair<std::vector<StructureType>, std::vector<uint64_t>>
StructureAnalysis::computeRawRMSD(const OpenDXA::PTM& ptm, size_t N){
    // Allocate space to record every atom's RMSD
    _ptmRmsd = std::make_shared<ParticleProperty>(N, DataType::Float, 1, 0.0f, true);
    std::vector<uint64_t> cached(N, 0ull);
    std::vector<StructureType> ptmTypes(N);
    
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto& r) {
        PTM::Kernel kernel(ptm);
        for(size_t i = r.begin(); i < r.end(); ++i){
            kernel.cacheNeighbors(i, &cached[i]);
            ptmTypes[i] = kernel.identifyStructure(i, cached);
            _ptmRmsd->setFloat(i, static_cast<float>(kernel.rmsd()));
        }
    });

    return { std::move(ptmTypes), std::move(cached) };
}

// By calculating the 95th percentile of the RMSD distribution, we 
// discard the worst 5% of matches (potential outliers or defects). 
// This way, we ignore highly deformed or poorly fitted structures and 
// ensure that the cut is not biased by extremely high values. 
// Furthermore, we guarantee a robust, flexible, and adaptive PTM.  
float StructureAnalysis::computeAdaptiveRMSDCutoff(){
    const size_t N = positions()->size();
    std::vector<float> rmsdValues(_ptmRmsd->dataFloat(), _ptmRmsd->dataFloat() + N);
    
    if(rmsdValues.empty()) return 0.0f;
    
    size_t idx95 = static_cast<size_t>(0.95 * (rmsdValues.size() - 1));
    std::nth_element(rmsdValues.begin(), rmsdValues.begin() + idx95, rmsdValues.end());
    
    const float cutoffMin = 0.15f;
    float autoCutoff = rmsdValues[idx95];
    float finalCutoff = std::max(cutoffMin, autoCutoff);
    
    spdlog::debug("PTM auto-cutoff (95th percentile): {}, using final cutoff: {}", autoCutoff, finalCutoff);
    return finalCutoff;
}

bool StructureAnalysis::setupPTM(OpenDXA::PTM& ptm, size_t N){
    // By running with an infinite RMSD cutoff, the PTM kernel never rejects any structure for 
    // exceeding the threshold, so we collect the true RMSD of all atoms against the model without 
    // any bias. With that full collection of RMSDs (stored in _ptmRmsd), we then compute an 
    // adaptive cutoff (the 95th percentile) that reflects the typical fit quality in the particular 
    // system. Only after this distribution is known, a final cutoff (the maximum between the 95th 
    // percentile and an absolute minimum) is applied to robustly and flexibly filter out bad matches 
    // instead of using a fixed or arbitrary value.
    ptm.setCalculateDefGradient(true);
    ptm.setRmsdCutoff(std::numeric_limits<double>::infinity());
    
    return ptm.prepare(positions()->constDataPoint3(), N, cell());
}

void StructureAnalysis::allocatePTMOutputArrays(size_t N){
    _ptmOrientation = std::make_shared<ParticleProperty>(N, DataType::Float, 4, 0.0f, true);
    _ptmDeformationGradient = std::make_shared<ParticleProperty>(N, DataType::Float, 9, 0.0f, true);
    
    // Clear arrays for second pass
    std::fill(_neighborLists->dataInt(), 
              _neighborLists->dataInt() + _neighborLists->size() * _neighborLists->componentCount(), -1);
    std::fill(_structureTypes->dataInt(), 
              _structureTypes->dataInt() + _structureTypes->size(), LATTICE_OTHER);
}

void StructureAnalysis::filterAtomsByRMSD(
    const OpenDXA::PTM& ptm, 
    size_t N,
    const std::vector<StructureType>& ptmTypes,
    const std::vector<uint64_t>& cached,
    float cutoff
){
    // Only keep atoms whose RMSD <= finalCutoff
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto &r){
        PTM::Kernel kernel(ptm);
        for(size_t i = r.begin(); i < r.end(); ++i){
            processPTMAtom(kernel, i, ptmTypes[i], cached, cutoff);
        }
    });
}

void StructureAnalysis::storeNeighborIndices(const PTM::Kernel& kernel, size_t atomIndex){
    int numNeighbors = kernel.numTemplateNeighbors();
    assert(numNeighbors <= _neighborLists->componentCount());
    
    for(int j = 0; j < numNeighbors; ++j){
        _neighborLists->setIntComponent(atomIndex, j, kernel.getTemplateNeighbor(j).index);
    }
}

void StructureAnalysis::storeOrientationData(const PTM::Kernel& kernel, size_t atomIndex){
    auto quaternion = kernel.orientation();
    double* orientation = _ptmOrientation->dataFloat() + 4 * atomIndex;
    
    orientation[0] = static_cast<float>(quaternion.x());
    orientation[1] = static_cast<float>(quaternion.y());
    orientation[2] = static_cast<float>(quaternion.z());
    orientation[3] = static_cast<float>(quaternion.w());
}

void StructureAnalysis::storeDeformationGradient(const PTM::Kernel& kernel, size_t atomIndex) {
    const auto& F = kernel.deformationGradient();
    double* F_dest = _ptmDeformationGradient->dataFloat() + 9 * atomIndex;
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
    float rmsd = _ptmRmsd->getFloat(atomIndex);
    if(type == StructureType::OTHER || rmsd > cutoff) return;
    
    kernel.identifyStructure(atomIndex, cached);
    
    storeNeighborIndices(kernel, atomIndex);
    _structureTypes->setInt(atomIndex, type);
    storeOrientationData(kernel, atomIndex);
    storeDeformationGradient(kernel, atomIndex);
}

// Runs the Polyhedral Template Matching (PTM) algorithm on every atom,
// collects raw RMSD values (with no initial cutoff), then computes
// an adaptive threshold (95th percentile of the distribution, clamped to a minimum)
// and finally reruns structure identification keeping only those whose 
// RMSD <= threshold. We store per-atom orientation quaternions and
// deformation gradients for all "good" matches.
void StructureAnalysis::determineLocalStructuresWithPTM() {
    const size_t N = positions()->size();
    if(N == 0){
        return;
    }

    OpenDXA::PTM ptm;
    if(!setupPTM(ptm, N)){
        throw std::runtime_error("Error trying to initialize PTM.");
    }

    auto [ptmTypes, cached] = computeRawRMSD(ptm, N);
    float finalCutoff = computeAdaptiveRMSDCutoff();

    if(finalCutoff > 0){
        allocatePTMOutputArrays(N);
        filterAtomsByRMSD(ptm, N, ptmTypes, cached, finalCutoff);
    }
}

/// Once we have neighbor lists from PTM, find the single largest atom‐to‐neighbor
/// distance (respecting periodic wrapping).  This maximum sets a safe "search radius"
/// for all later routines (e.g. ghost‐layer size in Delaunay, node‐connect threshold in
/// mesh building) so we reliably include every bond in subsequent stages.
void StructureAnalysis::computeMaximumNeighborDistanceFromPTM(){
    const size_t N = positions()->size();
    if(N == 0){
        _maximumNeighborDistance = 0.0;
        return;
    }

    const int M = _neighborLists->componentCount();
    const auto* pos = positions()->constDataPoint3();
    const auto& invMat = cell().inverseMatrix();
    const auto& dirMat = cell().matrix();

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
                int nb = _neighborLists->getIntComponent(i, j);
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

void StructureAnalysis::identifyStructuresCNA(){
    int maxNeighborListSize = std::min((int)_neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
    NearestNeighborFinder neighFinder(maxNeighborListSize);
    if(!neighFinder.prepare(positions(), cell(), _particleSelection)){
        throw std::runtime_error("Error in neighFinder.preapre(...)");
    }

    _maximumNeighborDistance = tbb::parallel_reduce(tbb::blocked_range<size_t>(0, positions()->size()),
        0.0, [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
            for (size_t index = r.begin(); index != r.end(); ++index) {
                double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _neighborLists);
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

bool StructureAnalysis::alreadyProcessedAtom(int index) {
    if(usingPTM()){
        return _atomClusters->getInt(index) != 0 || _structureTypes->getInt(index) == StructureType::OTHER;
    }
    return _atomClusters->getInt(index) != 0 || _structureTypes->getInt(index) == CoordinationStructureType::COORD_OTHER;
}

// Groups atoms with the same structure (FCC, BCC, HCP, etc.).
Cluster* StructureAnalysis::startNewCluster(int atomIndex, int structureType){
    Cluster* cluster = clusterGraph().createCluster(structureType);
    assert(cluster->id > 0);
    cluster->atomCount = 1;
    _atomClusters->setInt(atomIndex, cluster->id);
    _atomSymmetryPermutations->setInt(atomIndex, 0);
    return cluster;
}

void StructureAnalysis::processAtomConnections(size_t atomIndex){
    int clusterId = _atomClusters->getInt(atomIndex);
    if(clusterId == 0) return;
    Cluster* cluster1 = clusterGraph().findCluster(clusterId);
    assert(cluster1);
    connectClusterNeighbors(atomIndex, cluster1);
}

void StructureAnalysis::initializePTMClusterOrientation(Cluster* cluster, size_t seedAtomIndex){
    double* qdat = _ptmOrientation->dataFloat() + seedAtomIndex * 4;
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

void StructureAnalysis::buildClustersPTM() {
    const size_t N = positions()->size();

    for(size_t seedAtomIndex = 0; seedAtomIndex < N; ++seedAtomIndex){
        if(alreadyProcessedAtom(seedAtomIndex)) continue;

        int structureType = _structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        initializePTMClusterOrientation(cluster, seedAtomIndex);

        std::deque<int> atomsToVisit{ int(seedAtomIndex) };
        growClusterPTM(cluster, atomsToVisit, structureType);
    }

    reorientAtomsToAlignClusters();
}

// If the misorientation is less than 5 degrees, then it is the 
// same grain, otherwise they are different grains.
bool StructureAnalysis::areOrientationsCompatible(int atom1, int atom2){
    // Obtain the orientations provided by PTM for both atoms
    const double* q1Data = _ptmOrientation->dataFloat() + atom1 * 4;
    const double* q2Data = _ptmOrientation->dataFloat() + atom2 * 4;
    // Quaternions represent the crystallographic orientation of atoms
    Quaternion q1(q1Data[0], q1Data[1], q1Data[2], q1Data[3]);
    Quaternion q2(q2Data[0], q2Data[1], q2Data[2], q2Data[3]);
    // Calculate the difference in orientation. 
    // q1.inverse() "undoes" the rotation of atom 1, and q1.inverse() * q2
    // calculate the rotation required to go from orientation 1 to orientation 2
    Quaternion q_diff = q1.inverse() * q2;
    // Convert to angle of disorientation
    double angle = 2.0 * std::acos(std::abs(q_diff.w()));
    // Criterion: Are they sufficiently aligned? (5 degrees)
    // A quaternion [x, y, z, w] represents angle of 
    // rotation = 2 * arcs(|w|). If w = 1, angle = 0 (sem rotation); 
    // if w = 0, angle = 180 (maximum rotation).
    const double MAX_MIS_ORIENTATION = 5.0 * M_PI / 180.0;
    return angle < MAX_MIS_ORIENTATION;
}

void StructureAnalysis::growClusterPTM(Cluster* cluster, std::deque<int>& atomsToVisit, int structureType){
    while(!atomsToVisit.empty()){
        int currentAtom = atomsToVisit.front();
        atomsToVisit.pop_front();

        int numNeighbors = numberOfNeighbors(currentAtom);
        for(int ni = 0; ni < numNeighbors; ++ni){
            int neighbor = getNeighbor(currentAtom, ni);
            if(neighbor < 0 || neighbor == currentAtom) continue;
            if(_atomClusters->getInt(neighbor) != 0) continue;
            if(_structureTypes->getInt(neighbor) != structureType) continue;
            if(areOrientationsCompatible(currentAtom, neighbor)){
                _atomClusters->setInt(neighbor, cluster->id);
                cluster->atomCount++;
                atomsToVisit.push_back(neighbor);
            }
        }
    }
}

void StructureAnalysis::growCluster(
    Cluster* cluster,
    std::deque<int>& atomsToVisit,
    Matrix_3<double>& orientationV,
    Matrix_3<double>& orientationW,
    int structureType
) {
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];

    while (!atomsToVisit.empty()) {
        int currentAtomIndex = atomsToVisit.front();
        atomsToVisit.pop_front();

        int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(currentAtomIndex);
        const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

        for (int neighborIndex = 0; neighborIndex < coordStructure.numNeighbors; neighborIndex++) {
            int neighborAtomIndex = getNeighbor(currentAtomIndex, neighborIndex);
            assert(neighborAtomIndex != currentAtomIndex);

            const Vector3& latticeVector = latticeStructure.latticeVectors[permutation[neighborIndex]];
            const Vector3& spatialVector = cell().wrapVector(
                positions()->getPoint3(neighborAtomIndex) - positions()->getPoint3(currentAtomIndex)
            );

            for (size_t i = 0; i < 3; i++) {
                for (size_t j = 0; j < 3; j++) {
                    orientationV(i, j) += (double)(latticeVector[j] * latticeVector[i]);
                    orientationW(i, j) += (double)(latticeVector[j] * spatialVector[i]);
                }
            }

            if (_atomClusters->getInt(neighborAtomIndex) != 0) continue;
            if (_structureTypes->getInt(neighborAtomIndex) != structureType) continue;

            Matrix3 tm1, tm2;
            bool properOverlap = true;

            for (int i = 0; i < 3; i++) {
                int atomIndex;
                if (i != 2) {
                    atomIndex = getNeighbor(currentAtomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
                    tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
                                    latticeStructure.latticeVectors[permutation[neighborIndex]];
                } else {
                    atomIndex = currentAtomIndex;
                    tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
                }

                assert(numberOfNeighbors(neighborAtomIndex) == coordStructure.numNeighbors);
                int j = findNeighbor(neighborAtomIndex, atomIndex);
                if (j == -1) {
                    properOverlap = false;
                    break;
                }
                tm2.column(i) = latticeStructure.latticeVectors[j];
            }

            if (!properOverlap) continue;

            assert(std::abs(tm1.determinant()) > EPSILON);
            Matrix3 tm2inverse;
            if (!tm2.inverse(tm2inverse)) continue;

            Matrix3 transition = tm1 * tm2inverse;

            for (size_t i = 0; i < latticeStructure.permutations.size(); i++) {
                if (transition.equals(latticeStructure.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)) {
                    _atomClusters->setInt(neighborAtomIndex, cluster->id);
                    cluster->atomCount++;
                    _atomSymmetryPermutations->setInt(neighborAtomIndex, i);
                    atomsToVisit.push_back(neighborAtomIndex);
                    break;
                }
            }
        }
    }
}

void StructureAnalysis::applyPreferredOrientation(Cluster* cluster) {
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[cluster->structure];
    double smallestDeviation = std::numeric_limits<double>::max();
    Matrix3 oldOrientation = cluster->orientation;

    for(int symIndex = 0; symIndex < latticeStructure.permutations.size(); ++symIndex){
        const Matrix3& symMatrix = latticeStructure.permutations[symIndex].transformation;
        Matrix3 newOrientation = oldOrientation * symMatrix.inverse();
        double scaling = std::pow(std::abs(newOrientation.determinant()), 1.0 / 3.0);

        for(const auto& preferredOrientation : _preferredCrystalOrientations){
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

void StructureAnalysis::reorientAtomsToAlignClusters(){
    tbb::parallel_for(
        tbb::blocked_range<size_t>(0, positions()->size()),
        [this](const tbb::blocked_range<size_t>& r) {
            for (size_t atomIndex = r.begin(); atomIndex != r.end(); ++atomIndex) {
                int clusterId = _atomClusters->getInt(atomIndex);
                if (clusterId == 0) continue;

                Cluster* cluster = clusterGraph().findCluster(clusterId);
                assert(cluster);
                if (cluster->symmetryTransformation == 0) continue;

                const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[cluster->structure];
                int oldSymmetry = _atomSymmetryPermutations->getInt(atomIndex);
                int newSymmetry = latticeStructure.permutations[oldSymmetry].inverseProduct[cluster->symmetryTransformation];
                _atomSymmetryPermutations->setInt(atomIndex, newSymmetry);
            }
        }
    );
}

void StructureAnalysis::buildClustersCNA(){
    for(size_t seedAtomIndex = 0; seedAtomIndex < positions()->size(); seedAtomIndex++){
        if(alreadyProcessedAtom(seedAtomIndex)) continue;

        int structureType = _structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();
        std::deque<int> atomsToVisit(1, seedAtomIndex);

        growCluster(cluster, atomsToVisit, orientationV, orientationW, structureType);
        cluster->orientation = Matrix3(orientationW * orientationV.inverse());

        if(structureType == _inputCrystalType && !_preferredCrystalOrientations.empty()){
            applyPreferredOrientation(cluster);
        }
    }

    reorientAtomsToAlignClusters();
}

void StructureAnalysis::buildClusters(){
    if(usingPTM()){
        buildClustersPTM();
        return;
    }

    buildClustersCNA();
}

std::tuple<int, const LatticeStructure&, const CoordinationStructure&, const std::array<int, 16>&>
StructureAnalysis::getAtomStructureInfo(int atomIndex){
    int structureType = _structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symPermIndex = _atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symPermIndex].permutation;
    
    return {structureType, latticeStructure, coordStructure, permutation};
}

void StructureAnalysis::connectClusterNeighbors(int atomIndex, Cluster* cluster1){
    const auto [structureType, latticeStructureType, coordStructure, permutation] = getAtomStructureInfo(atomIndex);
    for(int ni = 0; ni < coordStructure.numNeighbors; ni++){
        int neighbor = getNeighbor(atomIndex, ni);
        processNeighborConnection(atomIndex, neighbor, ni, cluster1, structureType);
    }
}

void StructureAnalysis::addReverseNeighbor(int neighbor, int atomIndex){
    int otherListCount = numberOfNeighbors(neighbor);
    if(otherListCount < _neighborLists->componentCount()){
        _neighborLists->setIntComponent(neighbor, otherListCount, atomIndex);
    }
}

void StructureAnalysis::processNeighborConnection(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, int structureType){
    int neighborClusterId = _atomClusters->getInt(neighbor);
    if(neighborClusterId == 0){
        addReverseNeighbor(neighbor, atomIndex);
        return;
    }

    if(neighborClusterId == cluster1->id) return;

    Cluster* cluster2 = clusterGraph().findCluster(neighborClusterId);
    assert(cluster2);

    if(ClusterTransition* existing = cluster1->findTransition(cluster2)){
        existing->area++;
        existing->reverse->area++;
        return;
    }

    createNewClusterTransition(atomIndex, neighbor, neighborIndex, cluster1, cluster2);
}

void StructureAnalysis::createNewClusterTransition(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, Cluster* cluster2){
    Matrix3 transition;
    if(!calculateMisorientation(atomIndex, neighbor, neighborIndex, transition)) return;
    if(!transition.isOrthogonalMatrix()) return;
    if(!cluster1->findTransition(cluster2)){
        ClusterTransition* t = clusterGraph().createClusterTransition(cluster1, cluster2, transition);
        t->area++;
        t->reverse->area++;
    }
}

void StructureAnalysis::connectClusters(){
    auto indices = std::views::iota(size_t{0}, positions()->size());
    std::for_each(std::execution::par, indices.begin(), indices.end(), [this](size_t atomIndex){
        processAtomConnections(atomIndex);
    });
}

bool StructureAnalysis::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition) {
    int structureType = _structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symIndex = _atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symIndex].permutation;

    Matrix3 tm1, tm2;
    for (int i = 0; i < 3; i++){
        int ai;
        if(i != 2){
            ai = getNeighbor(atomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
            tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
                            latticeStructure.latticeVectors[permutation[neighborIndex]];
        }else{
            ai = atomIndex;
            tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
        }

        if(numberOfNeighbors(neighbor) != coordStructure.numNeighbors) return false;
        int j = findNeighbor(neighbor, ai);
        if(j == -1) return false;

        int neighborStructureType = _structureTypes->getInt(neighbor);
        const LatticeStructure& neighborLattice = CoordinationStructures::_latticeStructures[neighborStructureType];
        int neighborSymIndex = _atomSymmetryPermutations->getInt(neighbor);
        const auto& neighborPerm = neighborLattice.permutations[neighborSymIndex].permutation;

        tm2.column(i) = neighborLattice.latticeVectors[neighborPerm[j]];
    }

    if (std::abs(tm1.determinant()) < EPSILON) return false;
    Matrix3 tm1inv;
    if (!tm1.inverse(tm1inv)) return false;

    outTransition = tm2 * tm1inv;
    return true;
}

void StructureAnalysis::initializeClustersForSuperclusterFormation(){
    for(Cluster* cluster : clusterGraph().clusters()){
        if(!cluster || cluster->id == 0) continue;
        cluster->rank = 0;
        assert(cluster->parentTransition == nullptr);
    }
}

void StructureAnalysis::processDefectClusters(){
    for(Cluster* cluster : clusterGraph().clusters()){
        if(!cluster || cluster->id == 0) continue;
        if(cluster->structure != _inputCrystalType){
            processDefectCluster(cluster);
        }
    }
}

void StructureAnalysis::mergeCompatibleGrains(size_t oldTransitionCount, size_t newTransitionCount){
    for(size_t i = oldTransitionCount; i < newTransitionCount; i++){
        ClusterTransition* transition = clusterGraph().clusterTransitions()[i];
        // Validate transitions properties
        assert(transition->distance == 2);
        assert(transition->cluster1->structure == _inputCrystalType);
        assert(transition->cluster2->structure == _inputCrystalType);
                
        auto [parent1, parent2] = getParentGrains(transition);
        if(parent1 == parent2) continue;
        
        ClusterTransition* parentTransition = buildParentTransition(transition, parent1, parent2);
        assignParentTransition(parent1, parent2, parentTransition);
    }
}

Cluster* StructureAnalysis::getParentGrain(Cluster* c){
    if(!c->parentTransition) return c;

    ClusterTransition* parentT = c->parentTransition;
    Cluster* parent = parentT->cluster2;

    while(parent->parentTransition){
        parentT = clusterGraph().concatenateClusterTransitions(parentT, parent->parentTransition);
        parent = parent->parentTransition->cluster2;
    }

    c->parentTransition = parentT;
    return parent;
}

std::pair<Cluster*, Cluster*> StructureAnalysis::getParentGrains(ClusterTransition* transition){
    Cluster* parent1 = getParentGrain(transition->cluster1);
    Cluster* parent2 = getParentGrain(transition->cluster2);
    return {parent1, parent2};
}

ClusterTransition* StructureAnalysis::buildParentTransition(ClusterTransition* transition, Cluster* parent1, Cluster* parent2){
    ClusterTransition* parentTransition = transition;
    
    if(parent2 != transition->cluster2){
        parentTransition = clusterGraph().concatenateClusterTransitions(parentTransition, transition->cluster2->parentTransition);
    }
    
    if(parent1 != transition->cluster1){
        parentTransition = clusterGraph().concatenateClusterTransitions(transition->cluster1->parentTransition->reverse, parentTransition);
    }
    
    return parentTransition;
}

void StructureAnalysis::assignParentTransition(Cluster* parent1, Cluster* parent2, ClusterTransition* parentTransition){
    if(parent1->rank > parent2->rank){
        parent2->parentTransition = parentTransition->reverse;
        return;
    }

    parent1->parentTransition = parentTransition;
    
    if(parent1->rank == parent2->rank){
        parent2->rank++;
    }
}

void StructureAnalysis::processDefectCluster(Cluster* defectCluster){
    for(ClusterTransition* t = defectCluster->transitions; t; t = t->next){
        if(t->cluster2->structure != _inputCrystalType || t->distance != 1) continue;
        for(ClusterTransition* t2 = t->next; t2; t2 = t2->next) {
            if(t2->cluster2->structure != _inputCrystalType || t2->distance != 1) continue;
            if(t2->cluster2 == t->cluster2) continue;

            const LatticeStructure& lattice = CoordinationStructures::latticeStructure(t2->cluster2->structure);
            Matrix3 misorientation = t2->tm * t->reverse->tm;

            for(const auto& sym : lattice.permutations){
                if(sym.transformation.equals(misorientation, CA_TRANSITION_MATRIX_EPSILON)){
                    clusterGraph().createClusterTransition(t->cluster2, t2->cluster2, misorientation, 2);
                    break;
                }
            }
        }
    }
}

void StructureAnalysis::formSuperClusters(){
    size_t oldTransitionCount = clusterGraph().clusterTransitions().size();
    
    initializeClustersForSuperclusterFormation();
    processDefectClusters();
    
    size_t newTransitionCount = clusterGraph().clusterTransitions().size();
    mergeCompatibleGrains(oldTransitionCount, newTransitionCount);
    
    finalizeParentGrains();
}

void StructureAnalysis::finalizeParentGrains(){
    for(Cluster* cluster : clusterGraph().clusters()){
        getParentGrain(cluster);
    }
}

}
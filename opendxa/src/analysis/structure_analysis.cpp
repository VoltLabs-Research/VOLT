#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <tbb/parallel_reduce.h>

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
    _atomClusters(std::make_unique<ParticleProperty>(positions->size(), DataType::Int, 1, 0, "ClusterProperty", true)),
    _atomSymmetryPermutations(std::make_unique<ParticleProperty>(positions->size(), DataType::Int, 1, 0, "SymmetryPermutations", false)),
    _clusterGraph(std::make_unique<ClusterGraph>()),
    _preferredCrystalOrientations(std::move(preferredCrystalOrientations))
{
    static std::once_flag init_flag;
    std::call_once(init_flag, []() {
        CoordinationStructures::initializeStructures();
    });

    if(usingPTM()){
        static constexpr int maxPtmNeighbors = 14;
        _neighborLists = std::make_shared<ParticleProperty>(positions->size(), DataType::Int, maxPtmNeighbors, 0, "Neighbors", false);
    }else{
        _neighborLists = std::make_shared<ParticleProperty>(positions->size(), DataType::Int,
            _coordStructures.latticeStructure(inputCrystalType).maxNeighbors, 0, "Neighbors", false);
    }

    std::fill(_neighborLists->dataInt(), _neighborLists->dataInt() + _neighborLists->size() * _neighborLists->componentCount(), -1);
    std::fill(_structureTypes->dataInt(), _structureTypes->dataInt() + _structureTypes->size(), LATTICE_OTHER);
}

// Runs the Polyhedral Template Matching (PTM) algorithm on every atom,
// collects raw RMSD values (with no initial cutoff), then computes
// an adaptive threshold (95th percentile of the distribution, clamped to a minimum)
// and finally reruns structure identification keeping only those whose 
// RMSD <= threshold. We store per-atom orientation quaternions and
// deformation gradients for all "good" matches.
bool StructureAnalysis::determineLocalStructuresWithPTM() {
    const size_t N = positions()->size();
    if (N == 0) return true;

    OpenDXA::PTM ptm;
    ptm.setCalculateDefGradient(true);
    // By running with an infinite RMSD cutoff, the PTM kernel never rejects any structure for 
    // exceeding the threshold, so we collect the true RMSD of all atoms against the model without 
    // any bias. With that full collection of RMSDs (stored in _ptmRmsd), we then compute an 
    // adaptive cutoff (the 95th percentile) that reflects the typical fit quality in the particular 
    // system. Only after this distribution is known, a final cutoff (the maximum between the 95th 
    // percentile and an absolute minimum) is applied to robustly and flexibly filter out bad matches 
    // instead of using a fixed or arbitrary value.
    ptm.setRmsdCutoff(std::numeric_limits<double>::infinity());

    // Build the neighborhood search structures
    if(!ptm.prepare(positions()->constDataPoint3(), N, cell())){
        return false;
    }

    // Allocate space to record every atom's RMSD
    _ptmRmsd = std::make_shared<ParticleProperty>(N, DataType::Float, 1, 0.0f, "PTM_RMSD", true);
    std::vector<uint64_t> cached(N, 0ull);
    std::vector<StructureType> ptmTypes(N);

    // First pass, compute raw RMSD and provisional type for each atom
    tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto& r) {
        PTM::Kernel kernel(ptm);
        for (size_t i = r.begin(); i < r.end(); ++i) {
            kernel.cacheNeighbors(i, &cached[i]);
            ptmTypes[i] = kernel.identifyStructure(i, cached);
            _ptmRmsd->setFloat(i, static_cast<float>(kernel.rmsd()));
        }
    });

    // Gather RMSD values into a vector for percentile calculation
    std::vector<float> v(_ptmRmsd->dataFloat(), _ptmRmsd->dataFloat() + N);
    if(!v.empty()){
        // By calculating the 95th percentile of the RMSD distribution, we 
        // discard the worst 5% of matches (potential outliers or defects). 
        // This way, we ignore highly deformed or poorly fitted structures and 
        // ensure that the cut is not biased by extremely high values. 
        // Furthermore, we guarantee a robust, flexible, and adaptive PTM.
        size_t idx95 = static_cast<size_t>(0.95 * (v.size() - 1));
        std::nth_element(v.begin(), v.begin() + idx95, v.end());
        float autoCutoff = v[idx95];
        const float cutoffMin = 0.15f;
        float finalCutoff = std::max(cutoffMin, autoCutoff);

        std::cout << "PTM auto-cutoff (95th percentile): " << autoCutoff << ", using finalCutoff = " << finalCutoff << std::endl;

        // Allocate output arrays only once we know the cutoff
        _ptmOrientation = std::make_shared<ParticleProperty>(N, DataType::Float, 4, 0.0f, "PTM_Orientation", true);
        _ptmDeformationGradient = std::make_shared<ParticleProperty>(N, DataType::Float, 9, 0.0f, "PTM_DeformationGradient", true);

        // Clear neighbor lists and sctructures types for the second pass
        std::fill(_neighborLists->dataInt(), _neighborLists->dataInt() + _neighborLists->size() * _neighborLists->componentCount(), -1);
        std::fill(_structureTypes->dataInt(), _structureTypes->dataInt() + _structureTypes->size(), LATTICE_OTHER);

        // Second pass, only keep atoms whose RMSD <= finalCutoff
        tbb::parallel_for(tbb::blocked_range<size_t>(0, N), [&](const auto& r) {
            PTM::Kernel kernel(ptm);
            for (size_t i = r.begin(); i < r.end(); ++i) {
                auto type = ptmTypes[i];
                float rmsd = _ptmRmsd->getFloat(i);
                if (type != StructureType::OTHER && rmsd <= finalCutoff) {
                    kernel.identifyStructure(i, cached);
                    
                    // Store neighbor indices
                    int nn = kernel.numTemplateNeighbors();
                    assert(nn <= _neighborLists->componentCount());
                    for (int j = 0; j < nn; ++j) {
                        _neighborLists->setIntComponent(i, j, kernel.getTemplateNeighbor(j).index);
                    }

                    // Map PTM structure enum to our lattice types
                    _structureTypes->setInt(i, type);

                    // Save orientation quaternion
                    auto quaternion = kernel.orientation();
                    double* orientation = _ptmOrientation->dataFloat() + 4 * i;
                    orientation[0] = static_cast<float>(quaternion.x());
                    orientation[1] = static_cast<float>(quaternion.y());
                    orientation[2] = static_cast<float>(quaternion.z());
                    orientation[3] = static_cast<float>(quaternion.w());
                    
                    // Save 3x3 deformation gradient
                    // TODO: I think we can use this value in Elastic Mapping or in some other step after the structural analysis.
                    const auto& F = kernel.deformationGradient();
                    double* F_dest = _ptmDeformationGradient->dataFloat() + 9 * i;
                    const double* F_src = F.elements();
                    for(int k=0; k<9; ++k) {
                        F_dest[k] = static_cast<float>(F_src[k]);
                    }
                }
            }
        });
    }

    return true;
}

/// Once we have neighbor lists from PTM, find the single largest atom‐to‐neighbor
/// distance (respecting periodic wrapping).  This maximum sets a safe "search radius"
/// for all later routines (e.g. ghost‐layer size in Delaunay, node‐connect threshold in
/// mesh building) so we reliably include every bond in subsequent stages.
void StructureAnalysis::computeMaximumNeighborDistanceFromPTM() {
    const size_t N = positions()->size();
    if (N == 0) {
        _maximumNeighborDistance = 0.0;
        return;
    }

    // Shortcut to data pointers and cell matrices
    const int M = _neighborLists->componentCount();
    const auto* pos = positions()->constDataPoint3();
    const auto& invMat = cell().inverseMatrix();
    const auto& dirMat = cell().matrix();

    double maxDistance = 0.0;
    for (size_t i = 0; i < N; ++i) {
        for (int j = 0; j < M; ++j) {
            int nb = _neighborLists->getIntComponent(i, j);
            if (nb < 0) break;

            // Compute wrapped displacement
            Vector3 delta = pos[nb] - pos[i];
            double f[3];
            for (int d = 0; d < 3; ++d) {
                f[d] = invMat.prodrow(delta, d);
                f[d] -= std::round(f[d]);
            }

            // Back to cartesian
            Vector3 mind;
            mind = dirMat.column(0) * f[0];
            mind += dirMat.column(1) * f[1];
            mind += dirMat.column(2) * f[2];
            double d = mind.length();
            if (d > maxDistance) maxDistance = d;
        }
    }

    std::cout << "Maximum neighbor distance (from PTM): " << maxDistance << std::endl;
    _maximumNeighborDistance = maxDistance;
}

bool StructureAnalysis::identifyStructures() {
    if(usingPTM()){
        determineLocalStructuresWithPTM();
        computeMaximumNeighborDistanceFromPTM();
        return true;
    }

    int maxNeighborListSize = std::min((int)_neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
    NearestNeighborFinder neighFinder(maxNeighborListSize);
    if (!neighFinder.prepare(positions(), cell(), _particleSelection)) return false;

    _maximumNeighborDistance = tbb::parallel_reduce(
        tbb::blocked_range<size_t>(0, positions()->size()),
        0.0,
        [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
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

    return true;
}

bool StructureAnalysis::shouldSkipSeed(int index) {
    if(usingPTM()){
        return _atomClusters->getInt(index) != 0 || _structureTypes->getInt(index) == StructureType::OTHER;
    }
    return _atomClusters->getInt(index) != 0 || _structureTypes->getInt(index) == CoordinationStructureType::COORD_OTHER;
}

Cluster* StructureAnalysis::startNewCluster(int atomIndex, int structureType) {
    Cluster* cluster = clusterGraph().createCluster(structureType);
    assert(cluster->id > 0);
    cluster->atomCount = 1;
    _atomClusters->setInt(atomIndex, cluster->id);
    _atomSymmetryPermutations->setInt(atomIndex, 0);
    return cluster;
}

bool StructureAnalysis::buildClustersPTM() {
    const size_t N = positions()->size();

    for (size_t seedAtomIndex = 0; seedAtomIndex < N; ++seedAtomIndex) {
        if (shouldSkipSeed(seedAtomIndex))
            continue;

        int structureType = _structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        {
            double* qdat = _ptmOrientation->dataFloat() + seedAtomIndex * 4;
            Quaternion q(qdat[0], qdat[1], qdat[2], qdat[3]);
            q.normalize();

            Vector3 ex(1.0, 0.0, 0.0), ey(0.0, 1.0, 0.0), ez(0.0, 0.0, 1.0);
            Matrix3 R;
            R.column(0) = q * ex;
            R.column(1) = q * ey;
            R.column(2) = q * ez;
            cluster->orientation = R;
        }

        std::deque<int> atomsToVisit{ int(seedAtomIndex) };
        growClusterPTM(cluster, atomsToVisit, structureType);
    }

    reorientAtomsToAlignClusters();
    return true;
}

void StructureAnalysis::growClusterPTM(
    Cluster* cluster,
    std::deque<int>& atomsToVisit,
    int structureType
) {
    const auto& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const auto& coordStructure = CoordinationStructures::_coordinationStructures[structureType];

    while (!atomsToVisit.empty()) {
        int currentAtom = atomsToVisit.front();
        atomsToVisit.pop_front();

        int permIndex = _atomSymmetryPermutations->getInt(currentAtom);
        const auto& permutation = latticeStructure.permutations[permIndex].permutation;

        for (int ni = 0; ni < coordStructure.numNeighbors; ++ni) {
            int nbr = getNeighbor(currentAtom, ni);
            if (nbr < 0 || nbr == currentAtom) continue;
            if (_atomClusters->getInt(nbr) != 0) continue;
            if (_structureTypes->getInt(nbr) != structureType) continue;

            bool properOverlap = true;
            Matrix3 tm1, tm2;
            for (int j = 0; j < 3; ++j) {
                int ai;
                if (j != 2) {
                    ai = getNeighbor(currentAtom, coordStructure.commonNeighbors[ni][j]);
                    tm1.column(j) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[ni][j]]]
                                    - latticeStructure.latticeVectors[permutation[ni]];
                } else {
                    ai = currentAtom;
                    tm1.column(j) = -latticeStructure.latticeVectors[permutation[ni]];
                }

                if (numberOfNeighbors(nbr) != coordStructure.numNeighbors) {
                    properOverlap = false;
                    break;
                }
                int k = findNeighbor(nbr, ai);
                if (k == -1) {
                    properOverlap = false;
                    break;
                }
                tm2.column(j) = latticeStructure.latticeVectors[k];
            }
            if (!properOverlap) continue;

            if (std::abs(tm1.determinant()) < EPSILON) continue;
            Matrix3 tm2inv;
            if (!tm2.inverse(tm2inv)) continue;

            Matrix3 transition = tm1 * tm2inv;

            for (size_t pi = 0; pi < latticeStructure.permutations.size(); ++pi) {
                if (transition.equals(latticeStructure.permutations[pi].transformation, CA_TRANSITION_MATRIX_EPSILON)) {
                    _atomClusters->setInt(nbr, cluster->id);
                    cluster->atomCount++;
                    _atomSymmetryPermutations->setInt(nbr, int(pi));
                    atomsToVisit.push_back(nbr);
                    break;
                }
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

    for (int symIndex = 0; symIndex < latticeStructure.permutations.size(); ++symIndex) {
        const Matrix3& symMatrix = latticeStructure.permutations[symIndex].transformation;
        Matrix3 newOrientation = oldOrientation * symMatrix.inverse();
        double scaling = std::pow(std::abs(newOrientation.determinant()), 1.0 / 3.0);

        for (const auto& preferredOrientation : _preferredCrystalOrientations) {
            double deviation = 0;
            for (size_t i = 0; i < 3; i++) {
                for (size_t j = 0; j < 3; j++) {
                    deviation += std::abs(newOrientation(i, j) / scaling - preferredOrientation(i, j));
                }
            }
            if (deviation < smallestDeviation) {
                smallestDeviation = deviation;
                cluster->symmetryTransformation = symIndex;
                cluster->orientation = newOrientation;
            }
        }
    }
}

void StructureAnalysis::reorientAtomsToAlignClusters() {
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

bool StructureAnalysis::buildClusters() {
    if(usingPTM()){
        return buildClustersPTM();
    }
    
    for (size_t seedAtomIndex = 0; seedAtomIndex < positions()->size(); seedAtomIndex++) {
        if (shouldSkipSeed(seedAtomIndex)) continue;

        int structureType = _structureTypes->getInt(seedAtomIndex);
        Cluster* cluster = startNewCluster(seedAtomIndex, structureType);

        Matrix_3<double> orientationV = Matrix_3<double>::Zero();
        Matrix_3<double> orientationW = Matrix_3<double>::Zero();
        std::deque<int> atomsToVisit(1, seedAtomIndex);

        growCluster(cluster, atomsToVisit, orientationV, orientationW, structureType);
        cluster->orientation = Matrix3(orientationW * orientationV.inverse());

        if (structureType == _inputCrystalType && !_preferredCrystalOrientations.empty()) {
            applyPreferredOrientation(cluster);
        }
    }

    reorientAtomsToAlignClusters();
    return true;
}

bool StructureAnalysis::connectClusters() {
    for (size_t atomIndex = 0; atomIndex < positions()->size(); atomIndex++) {
        int clusterId = _atomClusters->getInt(atomIndex);
        if (clusterId == 0) continue;

        Cluster* cluster1 = clusterGraph().findCluster(clusterId);
        assert(cluster1);
        connectClusterNeighbors(atomIndex, cluster1);
    }
    return true;
}

void StructureAnalysis::connectClusterNeighbors(int atomIndex, Cluster* cluster1) {
    int structureType = _structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symPermIndex = _atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symPermIndex].permutation;

    for (int ni = 0; ni < coordStructure.numNeighbors; ni++) {
        int neighbor = getNeighbor(atomIndex, ni);
        int neighborClusterId = _atomClusters->getInt(neighbor);

        if (neighborClusterId == 0 || neighborClusterId == cluster1->id) {
            if (neighborClusterId == 0) {
                int otherListCount = numberOfNeighbors(neighbor);
                if (otherListCount < _neighborLists->componentCount()) {
                    _neighborLists->setIntComponent(neighbor, otherListCount, atomIndex);
                }
            }
            continue;
        }

        Cluster* cluster2 = clusterGraph().findCluster(neighborClusterId);
        assert(cluster2);

        if (ClusterTransition* t = cluster1->findTransition(cluster2)) {
            t->area++;
            t->reverse->area++;
            continue;
        }

        Matrix3 transition;
        if (calculateMisorientation(atomIndex, neighbor, ni, transition)) {
            if (transition.isOrthogonalMatrix()) {
                ClusterTransition* t = clusterGraph().createClusterTransition(cluster1, cluster2, transition);
                t->area++;
                t->reverse->area++;
            }
        }
    }
}

bool StructureAnalysis::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition) {
    int structureType = _structureTypes->getInt(atomIndex);
    const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
    const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
    int symIndex = _atomSymmetryPermutations->getInt(atomIndex);
    const auto& permutation = latticeStructure.permutations[symIndex].permutation;

    Matrix3 tm1, tm2;
    for (int i = 0; i < 3; i++) {
        int ai;
        if (i != 2) {
            ai = getNeighbor(atomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
            tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
                            latticeStructure.latticeVectors[permutation[neighborIndex]];
        } else {
            ai = atomIndex;
            tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
        }

        if (numberOfNeighbors(neighbor) != coordStructure.numNeighbors) return false;
        int j = findNeighbor(neighbor, ai);
        if (j == -1) return false;

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

bool StructureAnalysis::formSuperClusters() {
    size_t oldTransitionCount = clusterGraph().clusterTransitions().size();

    for (Cluster* cluster : clusterGraph().clusters()) {
        if (!cluster || cluster->id == 0) continue;
        cluster->rank = 0;
        assert(cluster->parentTransition == nullptr);

        if (cluster->structure != _inputCrystalType) {
            processDefectCluster(cluster);
        }
    }

    size_t newTransitionCount = clusterGraph().clusterTransitions().size();

    for (size_t i = oldTransitionCount; i < newTransitionCount; i++) {
        ClusterTransition* t = clusterGraph().clusterTransitions()[i];
        assert(t->distance == 2);
        assert(t->cluster1->structure == _inputCrystalType);
        assert(t->cluster2->structure == _inputCrystalType);

        Cluster* parent1 = getParentGrain(t->cluster1);
        Cluster* parent2 = getParentGrain(t->cluster2);
        if (parent1 == parent2) continue;

        ClusterTransition* pt = t;
        if (parent2 != t->cluster2) {
            pt = clusterGraph().concatenateClusterTransitions(pt, t->cluster2->parentTransition);
        }

        if (parent1 != t->cluster1) {
            pt = clusterGraph().concatenateClusterTransitions(t->cluster1->parentTransition->reverse, pt);
        }

        if (parent1->rank > parent2->rank) {
            parent2->parentTransition = pt->reverse;
        } else {
            parent1->parentTransition = pt;
            if (parent1->rank == parent2->rank) parent2->rank++;
        }
    }

    for (Cluster* c : clusterGraph().clusters()) {
        getParentGrain(c);
    }

    return true;
}

void StructureAnalysis::processDefectCluster(Cluster* defectCluster) {
    for (ClusterTransition* t = defectCluster->transitions; t; t = t->next) {
        if (t->cluster2->structure != _inputCrystalType || t->distance != 1) continue;
        for (ClusterTransition* t2 = t->next; t2; t2 = t2->next) {
            if (t2->cluster2->structure != _inputCrystalType || t2->distance != 1) continue;
            if (t2->cluster2 == t->cluster2) continue;

            const LatticeStructure& lattice = CoordinationStructures::latticeStructure(t2->cluster2->structure);
            Matrix3 misorientation = t2->tm * t->reverse->tm;

            for (const auto& sym : lattice.permutations) {
                if (sym.transformation.equals(misorientation, CA_TRANSITION_MATRIX_EPSILON)) {
                    clusterGraph().createClusterTransition(t->cluster2, t2->cluster2, misorientation, 2);
                    break;
                }
            }
        }
    }
}

Cluster* StructureAnalysis::getParentGrain(Cluster* c) {
    if (!c->parentTransition) return c;

    ClusterTransition* parentT = c->parentTransition;
    Cluster* parent = parentT->cluster2;

    while (parent->parentTransition) {
        parentT = clusterGraph().concatenateClusterTransitions(parentT, parent->parentTransition);
        parent = parent->parentTransition->cluster2;
    }

    c->parentTransition = parentT;
    return parent;
}

}
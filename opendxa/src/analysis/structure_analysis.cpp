#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/structure_analysis.h>
#include <tbb/parallel_for.h>
#include <tbb/blocked_range.h>
#include <tbb/parallel_reduce.h> 
#include <cstring>

namespace OpenDXA{

StructureAnalysis::StructureAnalysis(ParticleProperty* positions, const SimulationCell& simCell,
		LatticeStructureType inputCrystalType, ParticleProperty* particleSelection,
		ParticleProperty* outputStructures, std::vector<Matrix3>&& preferredCrystalOrientations,
		bool identifyPlanarDefects, Mode _identificationMode) :
	_positions(positions), _simCell(simCell),
	_inputCrystalType(inputCrystalType),
	_identificationMode(_identificationMode),
	_structureTypes(outputStructures),
	_particleSelection(particleSelection),
	_coordStructures(outputStructures, inputCrystalType, identifyPlanarDefects, simCell),
	_atomClusters(new ParticleProperty(positions->size(), DataType::Int, 1, 0, "ClusterProperty", true)),
	_atomSymmetryPermutations(new ParticleProperty(positions->size(), DataType::Int, 1, 0, "SymmetryPermutations", false)),
	_clusterGraph(new ClusterGraph()),
	_preferredCrystalOrientations(std::move(preferredCrystalOrientations))
{
	static bool initialized = false;
	if(!initialized){
		_coordStructures.initializeStructures();
		initialized = true;
	}

	// Allocate memory for neighbor lists.
	_neighborLists = std::shared_ptr<ParticleProperty>(new ParticleProperty(positions->size(), DataType::Int,
			_coordStructures.latticeStructure(inputCrystalType).maxNeighbors, 0, "Neighbors", false));
	std::fill(_neighborLists->dataInt(), _neighborLists->dataInt() + _neighborLists->size() * _neighborLists->componentCount(), -1);

	// Reset atomic structure types.
	std::fill(_structureTypes->dataInt(), _structureTypes->dataInt() + _structureTypes->size(), LATTICE_OTHER);
}

bool StructureAnalysis::identifyStructures(){
    int maxNeighborListSize = std::min((int)_neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
    NearestNeighborFinder neighFinder(maxNeighborListSize);
    if(!neighFinder.prepare(positions(), cell(), _particleSelection)) return false;

    // Identify local structure and find maximum neighbor distance
    _maximumNeighborDistance = tbb::parallel_reduce(
        // The Iteration Range, from 0 to the total number of particles.
        tbb::blocked_range<size_t>(0, positions()->size()),
        0.0,
		// Executes for subranges of particles. 
		// Calculates the local structure and returns the local maximum found within its subrange.
        [this, &neighFinder](const tbb::blocked_range<size_t>& r, double max_dist_so_far) -> double {
            for(size_t index = r.begin(); index != r.end(); ++index){
                double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _neighborLists);
                if(localMaxDistance > max_dist_so_far){
                    max_dist_so_far = localMaxDistance;
                }
            }
            return max_dist_so_far;
        },
        // The Join Function, combines the results of two subranges.
		// In this case, simply take the maximum of the two local maxima..
        [](double a, double b) -> double {
            return std::max(a, b);
        }
    );

    return true;
}
bool StructureAnalysis::shouldSkipSeed(int index){
	return _atomClusters->getInt(index) != 0 || _structureTypes->getInt(index) == COORD_OTHER;
}

Cluster* StructureAnalysis::startNewCluster(int atomIndex, int structureType){
	Cluster* cluster = clusterGraph().createCluster(structureType);
	assert(cluster->id > 0);
	cluster->atomCount = 1;
	_atomClusters->setInt(atomIndex, cluster->id);
	_atomSymmetryPermutations->setInt(atomIndex, 0);
	return cluster;
}

void StructureAnalysis::growCluster(
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

		int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(currentAtomIndex);
		const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

		for(int neighborIndex = 0; neighborIndex < coordStructure.numNeighbors; neighborIndex++){
			int neighborAtomIndex = getNeighbor(currentAtomIndex, neighborIndex);
			assert(neighborAtomIndex != currentAtomIndex);

			// Update orientation matrices
			const Vector3& latticeVector = latticeStructure.latticeVectors[permutation[neighborIndex]];
			const Vector3& spatialVector = cell().wrapVector(
				positions()->getPoint3(neighborAtomIndex) - positions()->getPoint3(currentAtomIndex)
			);

			for(size_t i = 0; i < 3; i++){
				for(size_t j = 0; j < 3; j++){
					orientationV(i, j) += (double)(latticeVector[j] * latticeVector[i]);
					orientationW(i, j) += (double)(latticeVector[j] * spatialVector[i]);
				}
			}

			if(_atomClusters->getInt(neighborAtomIndex) != 0) continue;
			if(_structureTypes->getInt(neighborAtomIndex) != structureType) continue;

			// Check proper overlap
			Matrix3 tm1, tm2;
			bool properOverlap = true;

			for(int i = 0; i < 3; i++){
				int atomIndex;
				if(i != 2){
					atomIndex = getNeighbor(currentAtomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
					tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] -
						latticeStructure.latticeVectors[permutation[neighborIndex]];
				}else{
					atomIndex = currentAtomIndex;
					tm1.column(i) = -latticeStructure.latticeVectors[permutation[neighborIndex]];
				}

				assert(numberOfNeighbors(neighborAtomIndex) == coordStructure.numNeighbors);
				int j = findNeighbor(neighborAtomIndex, atomIndex);
				if(j == -1){
					properOverlap = false;
					break;
				}
				tm2.column(i) = latticeStructure.latticeVectors[j];
			}

			if(!properOverlap) continue;

			assert(std::abs(tm1.determinant()) > EPSILON);
			Matrix3 tm2inverse;
			if(!tm2.inverse(tm2inverse)) continue;

			Matrix3 transition = tm1 * tm2inverse;

			for(int i = 0; i < latticeStructure.permutations.size(); i++){
				if(transition.equals(latticeStructure.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
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

void StructureAnalysis::applyPreferredOrientation(Cluster* cluster){
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
            for(size_t atomIndex = r.begin(); atomIndex != r.end(); ++atomIndex){
                int clusterId = _atomClusters->getInt(atomIndex);
                if(clusterId == 0) continue;

                Cluster* cluster = clusterGraph().findCluster(clusterId);
                assert(cluster);
                if(cluster->symmetryTransformation == 0) continue;

                const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[cluster->structure];
                int oldSymmetry = _atomSymmetryPermutations->getInt(atomIndex);
                int newSymmetry = latticeStructure.permutations[oldSymmetry].inverseProduct[cluster->symmetryTransformation];
                _atomSymmetryPermutations->setInt(atomIndex, newSymmetry);
            }
        }
    );
}

bool StructureAnalysis::buildClusters(){
	for(size_t seedAtomIndex = 0; seedAtomIndex < positions()->size(); seedAtomIndex++){
		if(shouldSkipSeed(seedAtomIndex)) continue;

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
	return true;
}

bool StructureAnalysis::connectClusters(){
	for(size_t atomIndex = 0; atomIndex < positions()->size(); atomIndex++){
		int clusterId = _atomClusters->getInt(atomIndex);
		if(clusterId == 0) continue;

		Cluster* cluster1 = clusterGraph().findCluster(clusterId);
		assert(cluster1);
		connectClusterNeighbors(atomIndex, cluster1);
	}
	return true;
}

void StructureAnalysis::connectClusterNeighbors(int atomIndex, Cluster* cluster1){
	int structureType = _structureTypes->getInt(atomIndex);
	const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
	const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
	int symPermIndex = _atomSymmetryPermutations->getInt(atomIndex);
	const auto& permutation = latticeStructure.permutations[symPermIndex].permutation;

	for(int ni = 0; ni < coordStructure.numNeighbors; ni++){
		int neighbor = getNeighbor(atomIndex, ni);
		int neighborClusterId = _atomClusters->getInt(neighbor);

		if(neighborClusterId == 0 || neighborClusterId == cluster1->id){
			// Insert back-reference in neighbor list if unassigned.
			if(neighborClusterId == 0){
				int otherListCount = numberOfNeighbors(neighbor);
				if(otherListCount < _neighborLists->componentCount()){
					_neighborLists->setIntComponent(neighbor, otherListCount, atomIndex);
				}
			}
			continue;
		}

		Cluster* cluster2 = clusterGraph().findCluster(neighborClusterId);
		assert(cluster2);

		if(ClusterTransition* t = cluster1->findTransition(cluster2)){
			t->area++;
			t->reverse->area++;
			continue;
		}

		Matrix3 transition;
		if(calculateMisorientation(atomIndex, neighbor, ni, transition)){
			if(transition.isOrthogonalMatrix()){
				ClusterTransition* t = clusterGraph().createClusterTransition(cluster1, cluster2, transition);
				t->area++;
				t->reverse->area++;
			}
		}
	}
}

bool StructureAnalysis::calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition){
	int structureType = _structureTypes->getInt(atomIndex);
	const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
	const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
	int symIndex = _atomSymmetryPermutations->getInt(atomIndex);
	const auto& permutation = latticeStructure.permutations[symIndex].permutation;

	Matrix3 tm1, tm2;
	for(int i = 0; i < 3; i++){
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

	if(std::abs(tm1.determinant()) < EPSILON) return false;
	Matrix3 tm1inv;
	if(!tm1.inverse(tm1inv)) return false;

	outTransition = tm2 * tm1inv;
	return true;
}

bool StructureAnalysis::formSuperClusters(){
	size_t oldTransitionCount = clusterGraph().clusterTransitions().size();

	for(Cluster* cluster : clusterGraph().clusters()){
		if(!cluster || cluster->id == 0) continue;
		cluster->rank = 0;
		assert(cluster->parentTransition == nullptr);

		if(cluster->structure != _inputCrystalType){
			processDefectCluster(cluster);
		}
	}

	size_t newTransitionCount = clusterGraph().clusterTransitions().size();

	for(size_t i = oldTransitionCount; i < newTransitionCount; i++){
		ClusterTransition* t = clusterGraph().clusterTransitions()[i];
		assert(t->distance == 2);
		assert(t->cluster1->structure == _inputCrystalType);
		assert(t->cluster2->structure == _inputCrystalType);

		Cluster* parent1 = getParentGrain(t->cluster1);
		Cluster* parent2 = getParentGrain(t->cluster2);
		if(parent1 == parent2) continue;

		ClusterTransition* pt = t;
		if(parent2 != t->cluster2){
			pt = clusterGraph().concatenateClusterTransitions(pt, t->cluster2->parentTransition);
		}

		if(parent1 != t->cluster1){
			pt = clusterGraph().concatenateClusterTransitions(t->cluster1->parentTransition->reverse, pt);
		}

		if(parent1->rank > parent2->rank){
			parent2->parentTransition = pt->reverse;
		}else{
			parent1->parentTransition = pt;
			if(parent1->rank == parent2->rank) parent2->rank++;
		}
	}

	for(Cluster* c : clusterGraph().clusters()){
		getParentGrain(c);
	}

	return true;
}

void StructureAnalysis::processDefectCluster(Cluster* defectCluster){
	for(ClusterTransition* t = defectCluster->transitions; t; t = t->next){
		if(t->cluster2->structure != _inputCrystalType || t->distance != 1) continue;
		for(ClusterTransition* t2 = t->next; t2; t2 = t2->next){
			if(t2->cluster2->structure != _inputCrystalType || t2->distance != 1) continue;
			if(t2->cluster2 == t->cluster2) continue;

			const LatticeStructure& lattice = _coordStructures.latticeStructure(t2->cluster2->structure);
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

}
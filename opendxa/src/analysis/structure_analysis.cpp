#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/structure_analysis.h>
#include <cstring>

namespace OpenDXA{

StructureAnalysis::StructureAnalysis(ParticleProperty* positions, const SimulationCell& simCell,
		LatticeStructureType inputCrystalType, ParticleProperty* particleSelection,
		ParticleProperty* outputStructures, std::vector<Matrix3>&& preferredCrystalOrientations,
		bool identifyPlanarDefects) :
	_positions(positions), _simCell(simCell),
	_inputCrystalType(inputCrystalType),
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
	// Prepare the neighbor list.
	int maxNeighborListSize = std::min((int)_neighborLists->componentCount() + 1, (int)MAX_NEIGHBORS);
	NearestNeighborFinder neighFinder(maxNeighborListSize);
	if(!neighFinder.prepare(positions(), cell(), _particleSelection)) return false;

	// Identify local structure around each particle.
	_maximumNeighborDistance = 0;
	
	// Thread-safe collection of maximum distances
	std::vector<std::atomic<double>> threadMaxDistances(std::thread::hardware_concurrency());
	for(auto& dist : threadMaxDistances) {
		dist.store(0.0, std::memory_order_relaxed);
	}

	ParallelSystem::parallelFor(positions()->size(), [this, &neighFinder, &threadMaxDistances](size_t index){
		double localMaxDistance = _coordStructures.determineLocalStructure(neighFinder, index, _neighborLists);
		
		// Update thread-local maximum
		size_t threadId = index % threadMaxDistances.size();
		double current = threadMaxDistances[threadId].load(std::memory_order_relaxed);
		while(current < localMaxDistance && 
			  !threadMaxDistances[threadId].compare_exchange_weak(current, localMaxDistance, std::memory_order_relaxed)) {}
	});
	
	// Deterministically find the global maximum
	for(const auto& dist : threadMaxDistances) {
		double val = dist.load(std::memory_order_relaxed);
		if(val > _maximumNeighborDistance) {
			_maximumNeighborDistance = val;
		}
	}

	return true;
}

bool StructureAnalysis::buildClusters(){
	// Iterate over atoms, looking for those that have not been visited yet.
	for(size_t seedAtomIndex = 0; seedAtomIndex < positions()->size(); seedAtomIndex++){
		if(_atomClusters->getInt(seedAtomIndex) != 0) continue;
		int coordStructureType = _structureTypes->getInt(seedAtomIndex);

		if(coordStructureType == COORD_OTHER){
			continue;
		}

		// Start a new cluster.
		int latticeStructureType = coordStructureType;
		Cluster* cluster = clusterGraph().createCluster(latticeStructureType);
		assert(cluster->id > 0);
		cluster->atomCount = 1;
		_atomClusters->setInt(seedAtomIndex, cluster->id);
		_atomSymmetryPermutations->setInt(seedAtomIndex, 0);
		const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[coordStructureType];
		const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[latticeStructureType];

		// For calculating the cluster orientation.
		Matrix_3<double> orientationV = Matrix_3<double>::Zero();
		Matrix_3<double> orientationW = Matrix_3<double>::Zero();

		// Add neighboring atoms to the cluster.
		std::deque<int> atomsToVisit(1, seedAtomIndex);
		do{
			int currentAtomIndex = atomsToVisit.front();
			atomsToVisit.pop_front();

			// Look up symmetry permutation of current atom.
			int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(currentAtomIndex);
			const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

			// Visit neighbors of the current atom.
			for(int neighborIndex = 0; neighborIndex < coordStructure.numNeighbors; neighborIndex++){
				// An atom should not be a neighbor of itself.
				// We use the minimum image convention for simulation cells with periodic boundary conditions.
				int neighborAtomIndex = getNeighbor(currentAtomIndex, neighborIndex);
				assert(neighborAtomIndex != currentAtomIndex);

				// Add vector pair to matrices for computing the cluster orientation.
				const Vector3& latticeVector = latticeStructure.latticeVectors[permutation[neighborIndex]];
				const Vector3& spatialVector = cell().wrapVector(positions()->getPoint3(neighborAtomIndex) - positions()->getPoint3(currentAtomIndex));
				for(size_t i = 0; i < 3; i++){
					for(size_t j = 0; j < 3; j++){
						orientationV(i,j) += (double)(latticeVector[j] * latticeVector[i]);
						orientationW(i,j) += (double)(latticeVector[j] * spatialVector[i]);
					}
				}

				// Skip neighbors which are already part of the cluster, or which have a different coordination structure type.
				if(_atomClusters->getInt(neighborAtomIndex) != 0) continue;
				if(_structureTypes->getInt(neighborAtomIndex) != coordStructureType) continue;

				// Select three non-coplanar atoms, which are all neighbors of the current neighbor.
				// One of them is the current central atom, two are common neighbors.
				Matrix3 tm1, tm2;
				bool properOverlap = true;
				for(int i = 0; i < 3; i++){
					int atomIndex;
					if(i != 2){
						atomIndex = getNeighbor(currentAtomIndex, coordStructure.commonNeighbors[neighborIndex][i]);
						tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[neighborIndex][i]]] - latticeStructure.latticeVectors[permutation[neighborIndex]];
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

				// Determine the misorientation matrix.
				assert(std::abs(tm1.determinant()) > EPSILON);
				Matrix3 tm2inverse;
				if(!tm2.inverse(tm2inverse)) continue;
				Matrix3 transition = tm1 * tm2inverse;

				// Find the corresponding symmetry permutation.
				for(int i = 0; i < latticeStructure.permutations.size(); i++){
					if(transition.equals(latticeStructure.permutations[i].transformation, CA_TRANSITION_MATRIX_EPSILON)){
						// Make the neighbor atom part of the current cluster.
						_atomClusters->setInt(neighborAtomIndex, cluster->id);
						cluster->atomCount++;

						// Save the permutation index.
						_atomSymmetryPermutations->setInt(neighborAtomIndex, i);

						// Recursively continue with the neighbor.
						atomsToVisit.push_back(neighborAtomIndex);

						break;
					}
				}
			}
		}while(!atomsToVisit.empty());

		// Compute matrix, which transforms vectors from lattice space to simulation coordinates.
		cluster->orientation = Matrix3(orientationW * orientationV.inverse());

		if(latticeStructureType == _inputCrystalType && !_preferredCrystalOrientations.empty()){
			// Determine the symmetry permutation that leads to the best cluster orientation.
			// The best cluster orientation is the one that forms the smallest angle with one of the
			// preferred crystal orientations.
			double smallestDeviation = std::numeric_limits<double>::max();
			const Matrix3 oldOrientation = cluster->orientation;
			for(int symmetryPermutationIndex = 0; symmetryPermutationIndex < latticeStructure.permutations.size(); symmetryPermutationIndex++){
				const Matrix3& symmetryTMatrix = latticeStructure.permutations[symmetryPermutationIndex].transformation;
				Matrix3 newOrientation = oldOrientation * symmetryTMatrix.inverse();
				double scaling = std::pow(std::abs(newOrientation.determinant()), 1.0/3.0);
				for(const Matrix3& preferredOrientation : _preferredCrystalOrientations){
					double deviation = 0;
					for(size_t i = 0; i < 3; i++){
						for(size_t j = 0; j < 3; j++){
							deviation += std::abs(newOrientation(i, j)/scaling - preferredOrientation(i,j));
						}
					}
					if(deviation < smallestDeviation){
						smallestDeviation = deviation;
						cluster->symmetryTransformation = symmetryPermutationIndex;
						cluster->orientation = newOrientation;
					}
				}
			}
		}
	}

	// Reorient atoms to align clusters with global coordinate system.
	for(size_t atomIndex = 0; atomIndex < positions()->size(); atomIndex++){
		int clusterId = _atomClusters->getInt(atomIndex);
		if(clusterId == 0) continue;
		Cluster* cluster = clusterGraph().findCluster(clusterId);
		assert(cluster);
		if(cluster->symmetryTransformation == 0) continue;
		const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[cluster->structure];
		int oldSymmetryPermutation = _atomSymmetryPermutations->getInt(atomIndex);
		int newSymmetryPermutation = latticeStructure.permutations[oldSymmetryPermutation].inverseProduct[cluster->symmetryTransformation];
		_atomSymmetryPermutations->setInt(atomIndex, newSymmetryPermutation);
	}

	return true;
}

bool StructureAnalysis::connectClusters(){
	for(size_t atomIndex = 0; atomIndex < positions()->size(); atomIndex++){
		int clusterId = _atomClusters->getInt(atomIndex);
		if(clusterId == 0) continue;
		Cluster* cluster1 = clusterGraph().findCluster(clusterId);
		assert(cluster1);

		// Look up symmetry permutation of current atom.
		int structureType = _structureTypes->getInt(atomIndex);
		const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
		const CoordinationStructure& coordStructure = CoordinationStructures::_coordinationStructures[structureType];
		int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(atomIndex);
		const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;

		// Visit neighbors of the current atom.
		for(int ni = 0; ni < coordStructure.numNeighbors; ni++){
			int neighbor = getNeighbor(atomIndex, ni);

			// Skip neighbor atoms belonging to the same cluster or to no cluster at all.
			int neighborClusterId = _atomClusters->getInt(neighbor);
			if(neighborClusterId == 0 || neighborClusterId == clusterId){
				// Add this atom to the neighbor's list of neighbors.
				if(neighborClusterId == 0){
					int otherNeighborListCount = numberOfNeighbors(neighbor);
					if(otherNeighborListCount < _neighborLists->componentCount()){
						// Set neighbor (centralAtomIndex, neighborListIndex, neighborAtomIndex) (REFACTOR - DUPLICATED CODE COORDINATION STRUCTURES CPP)
						_neighborLists->setIntComponent(neighbor, otherNeighborListCount, atomIndex);
					}
				}

				continue;
			}
			Cluster* cluster2 = clusterGraph().findCluster(neighborClusterId);
			assert(cluster2);

			// Skip if there is already a transition between the two clusters.
			if(ClusterTransition* t = cluster1->findTransition(cluster2)){
				t->area++;
				t->reverse->area++;
				continue;
			}

			// Select three non-coplanar atoms, which are all neighbors of the current neighbor.
			// One of them is the current central atom, two are common neighbors.
			Matrix3 tm1, tm2;
			bool properOverlap = true;
			for(int i = 0; i < 3; i++) {
				int ai;
				if(i != 2){
					ai = getNeighbor(atomIndex, coordStructure.commonNeighbors[ni][i]);
					tm1.column(i) = latticeStructure.latticeVectors[permutation[coordStructure.commonNeighbors[ni][i]]] - latticeStructure.latticeVectors[permutation[ni]];
				}else{
					ai = atomIndex;
					tm1.column(i) = -latticeStructure.latticeVectors[permutation[ni]];
				}

				assert(numberOfNeighbors(neighbor) == coordStructure.numNeighbors);
				int j = findNeighbor(neighbor, ai);
				if(j == -1){
					properOverlap = false;
					break;
				}

				// Look up symmetry permutation of neighbor atom.
				int neighborStructureType = _structureTypes->getInt(neighbor);
				const LatticeStructure& neighborLatticeStructure = CoordinationStructures::_latticeStructures[neighborStructureType];
				int neighborSymmetryPermutationIndex = _atomSymmetryPermutations->getInt(neighbor);
				const auto& neighborPermutation = neighborLatticeStructure.permutations[neighborSymmetryPermutationIndex].permutation;

				tm2.column(i) = neighborLatticeStructure.latticeVectors[neighborPermutation[j]];
			}

			if(!properOverlap) continue;

			// Determine the misorientation matrix.
			assert(std::abs(tm1.determinant()) > EPSILON);
			Matrix3 tm1inverse;
			if(!tm1.inverse(tm1inverse)) continue;
			Matrix3 transition = tm2 * tm1inverse;

			if(transition.isOrthogonalMatrix()) {
				ClusterTransition* t = clusterGraph().createClusterTransition(cluster1, cluster2, transition);
				t->area++;
				t->reverse->area++;
			}
		}
	}

	return true;
}

bool StructureAnalysis::formSuperClusters(){
	size_t oldTransitionCount = clusterGraph().clusterTransitions().size();

	for(size_t clusterIndex = 0; clusterIndex < clusterGraph().clusters().size(); clusterIndex++){
		Cluster* cluster = clusterGraph().clusters()[clusterIndex];
		cluster->rank = 0;
		if(cluster->id == 0) continue;


		assert(cluster->parentTransition == nullptr);
		if(cluster->structure != _inputCrystalType){
			// Merge defect cluster with a parent lattice cluster.
			ClusterTransition* bestMerge = nullptr;
			for(ClusterTransition* t = cluster->transitions; t != nullptr; t = t->next){
				if(t->cluster2->structure == _inputCrystalType){
					assert(t->distance == 1);
					if(bestMerge == nullptr || bestMerge->area < t->area){
						bestMerge = t;
					}
				}
			}

			// Create transition between lattice clusters on both sides of the defect.
			for(ClusterTransition* t1 = cluster->transitions; t1 != nullptr; t1 = t1->next){
				if(t1->cluster2->structure == _inputCrystalType){
					assert(t1->distance == 1);
					for(ClusterTransition* t2 = t1->next; t2 != nullptr; t2 = t2->next){
						if(t2->cluster2->structure == _inputCrystalType && t2->cluster2 != t1->cluster2 && t2->distance == 1){
							// Check if the two clusters form a single crystal.
							const LatticeStructure& latticeStructure = _coordStructures.latticeStructure(t2->cluster2->structure);
							Matrix3 misorientation = t2->tm * t1->reverse->tm;
							for(const SymmetryPermutation& symElement : latticeStructure.permutations){
								if(symElement.transformation.equals(misorientation, CA_TRANSITION_MATRIX_EPSILON)){
									clusterGraph().createClusterTransition(t1->cluster2, t2->cluster2, misorientation, 2);
									break;
								}
							}
						}
					}
				}
			}
		}
	}

	size_t newTransitionCount = clusterGraph().clusterTransitions().size();

	auto getParentGrain = [this](Cluster* c){
		if(c->parentTransition == nullptr) return c;
		ClusterTransition* newParentTransition = c->parentTransition;
		Cluster* parent = newParentTransition->cluster2;
		while(parent->parentTransition != nullptr){
			newParentTransition = clusterGraph().concatenateClusterTransitions(newParentTransition, parent->parentTransition);
			parent = parent->parentTransition->cluster2;
		}
		c->parentTransition = newParentTransition;
		return parent;
	};

	// Merge crystal-crystal pairs.
	for(size_t index = oldTransitionCount; index < newTransitionCount; index++){
		ClusterTransition* t = clusterGraph().clusterTransitions()[index];
		assert(t->distance == 2);
		assert(t->cluster1->structure == _inputCrystalType && t->cluster2->structure == _inputCrystalType);

		Cluster* parentCluster1 = getParentGrain(t->cluster1);
		Cluster* parentCluster2 = getParentGrain(t->cluster2);
		if(parentCluster1 == parentCluster2) continue;

		ClusterTransition* parentTransition = t;
		if(parentCluster2 != t->cluster2){
			assert(t->cluster2->parentTransition->cluster2 == parentCluster2);
			parentTransition = clusterGraph().concatenateClusterTransitions(parentTransition, t->cluster2->parentTransition);
		}

		if(parentCluster1 != t->cluster1){
			assert(t->cluster1->parentTransition->cluster2 == parentCluster1);
			parentTransition = clusterGraph().concatenateClusterTransitions(t->cluster1->parentTransition->reverse, parentTransition);
		}

		if(parentCluster1->rank > parentCluster2->rank){
			parentCluster2->parentTransition = parentTransition->reverse;
		}else{
			parentCluster1->parentTransition = parentTransition;
			if(parentCluster1->rank == parentCluster2->rank){
				parentCluster2->rank++;
			}
		}
	}

	// Compress paths.
	for(Cluster* cluster : clusterGraph().clusters()){
		getParentGrain(cluster);
	}

	return true;
}

}
#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/structures/cluster_graph.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>
#include <opendxa/structures/coordination_structure.h>
#include <opendxa/structures/lattice_structure.h>
#include <opendxa/core/coordination_structures.h>
#include <opendxa/analysis/polyhedral_template_matching.h>

namespace OpenDXA{

class StructureAnalysis{
public:
	enum Mode{
		CNA,
		PTM
	};

	StructureAnalysis(
			ParticleProperty* positions,
			const SimulationCell& simCell,
			LatticeStructureType inputCrystalType,
			ParticleProperty* particleSelection,
			ParticleProperty* outputStructures,
			std::vector<Matrix3>&& preferredCrystalOrientations = std::vector<Matrix3>(),
			bool identifyPlanarDefects = true, Mode _identificationMode = Mode::CNA);

	bool identifyStructures();
	bool buildClusters();
	bool connectClusters();
	bool formSuperClusters();
	bool determineLocalStructuresWithPTM();
	void computeMaximumNeighborDistanceFromPTM();
	void growClusterPTM(
		Cluster* cluster,
		std::deque<int>& atomsToVisit,
		int structureType
	);

	bool buildClustersPTM();

	int atomCount() const{
		return positions()->size();
	}

	ParticleProperty* positions() const{
		return _positions;
	}

	const SimulationCell& cell() const{
		return _simCell;
	}

	ParticleProperty* structureTypes() const{
		return _structureTypes;
	}

	ParticleProperty* atomClusters() const{
		return _atomClusters.get();
	}

	double maximumNeighborDistance() const{
		return _maximumNeighborDistance;
	}

	bool usingPTM() const{
		return _identificationMode == StructureAnalysis::Mode::PTM;
	}

	const ClusterGraph& clusterGraph() const{
		return *_clusterGraph;
	}

	ClusterGraph& clusterGraph(){
		return *_clusterGraph;
	}

	Cluster* atomCluster(int atomIndex) const{
		return clusterGraph().findCluster(_atomClusters->getInt(atomIndex));
	}

	int numberOfNeighbors(int atomIndex) const {
		assert(_neighborLists);
		const int* neighborList = _neighborLists->constDataInt() + (size_t)atomIndex * _neighborLists->componentCount();
		size_t count = 0;
		while(count < _neighborLists->componentCount() && neighborList[count] != -1){
			count++;
		}
		return count;
	}

	int getNeighbor(int centralAtomIndex, int neighborListIndex) const{
		assert(_neighborLists);
		return _neighborLists->getIntComponent(centralAtomIndex, neighborListIndex);
	}

	int findNeighbor(int centralAtomIndex, int neighborAtomIndex) const{
		assert(_neighborLists);
		const int* neighborList = _neighborLists->constDataInt() + (size_t)centralAtomIndex * _neighborLists->componentCount();
		for(size_t index = 0; index < _neighborLists->componentCount() && neighborList[index] != -1; index++){
			if(neighborList[index] == neighborAtomIndex){
				return index;
			}
		}
		return -1;
	}

	void freeNeighborLists(){
		_neighborLists.reset();
		_atomSymmetryPermutations.reset();
	}

	void setIdentificationMode(Mode identificationMode){
		_identificationMode = identificationMode;
	}

	const Vector3& neighborLatticeVector(int centralAtomIndex, int neighborIndex) const{
		assert(_atomSymmetryPermutations);
		int structureType = _structureTypes->getInt(centralAtomIndex);
		const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
		assert(neighborIndex >= 0 && neighborIndex < CoordinationStructures::_coordinationStructures[structureType].numNeighbors);
		int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(centralAtomIndex);
		assert(symmetryPermutationIndex >= 0 && symmetryPermutationIndex < latticeStructure.permutations.size());
		const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;
		return latticeStructure.latticeVectors[permutation[neighborIndex]];
	}

private:
	bool shouldSkipSeed(int index);
	bool calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition);
	void connectClusterNeighbors(int atomIndex, Cluster* cluster1);

	Cluster* getParentGrain(Cluster* c);
	void processDefectCluster(Cluster* defectCluster);
	void reorientAtomsToAlignClusters();
	void applyPreferredOrientation(Cluster* cluster);
	void growCluster(
		Cluster* cluster,
		std::deque<int>& atomsToVisit,
		Matrix_3<double>& orientationV,
		Matrix_3<double>& orientationW,
		int structureType
	);

	Cluster* startNewCluster(int atomIndex, int structureType);

	Mode _identificationMode;
	CoordinationStructures _coordStructures;
	LatticeStructureType _inputCrystalType;
	ParticleProperty* _positions; 
	ParticleProperty* _structureTypes; 
	std::shared_ptr<ParticleProperty> _ptmRmsd; 
	std::shared_ptr<ParticleProperty> _ptmOrientation; 
	std::shared_ptr<ParticleProperty> _ptmDeformationGradient; 
	std::shared_ptr<ParticleProperty> _neighborLists; 
	std::shared_ptr<ParticleProperty> _atomClusters;
	std::shared_ptr<ParticleProperty> _atomSymmetryPermutations; 
	ParticleProperty* _particleSelection; 
	std::shared_ptr<ClusterGraph> _clusterGraph; 
	std::atomic<double> _maximumNeighborDistance;
	SimulationCell _simCell;
	std::vector<Matrix3> _preferredCrystalOrientations;
};

}
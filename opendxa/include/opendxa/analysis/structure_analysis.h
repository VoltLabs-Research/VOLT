#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/structures/cluster_graph.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>
#include <opendxa/structures/coordination_structure.h>
#include <opendxa/structures/lattice_structure.h>

namespace OpenDXA{

class StructureAnalysis{
public:
	enum CNAMode{
		FixedCutoffMode,
		AdaptiveCutoffMode
	};
	
	typedef unsigned int CNAPairBond;

	double cutoff() const{
        return _cutoff;
    }

    void setCutoff(double newCutoff){
        _cutoff = newCutoff;
    }

    CNAMode mode() const{
        return _cnaMode;
    }

    void setMode(CNAMode mode){
        _cnaMode = mode;
    }

    static int findCommonNeighbors(const NeighborBondArray& neighborArray, int neighborIndex, unsigned int &commonNeighbors, int numNeighbors);
    static int findNeighborBonds(const NeighborBondArray& neighborArray, unsigned int commonNeighbors, int numNeighbors, CNAPairBond* neighborBonds);
    static int calcMaxChainLength(CNAPairBond* neighborBonds, int numBonds);

public:
	StructureAnalysis(
			ParticleProperty* positions,
			const SimulationCell& simCell,
			LatticeStructureType inputCrystalType,
			ParticleProperty* particleSelection,
			ParticleProperty* outputStructures,
			std::vector<Matrix3>&& preferredCrystalOrientations = std::vector<Matrix3>(),
			bool identifyPlanarDefects = true);

	bool identifyStructures();
	bool buildClusters();
	bool connectClusters();
	bool formSuperClusters();

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

	void setNeighbor(int centralAtomIndex, int neighborListIndex, int neighborAtomIndex) const{
		_neighborLists->setIntComponent(centralAtomIndex, neighborListIndex, neighborAtomIndex);
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

	const Vector3& neighborLatticeVector(int centralAtomIndex, int neighborIndex) const{
		assert(_atomSymmetryPermutations);
		int structureType = _structureTypes->getInt(centralAtomIndex);
		const LatticeStructure& latticeStructure = _latticeStructures[structureType];
		assert(neighborIndex >= 0 && neighborIndex < _coordinationStructures[structureType].numNeighbors);
		int symmetryPermutationIndex = _atomSymmetryPermutations->getInt(centralAtomIndex);
		assert(symmetryPermutationIndex >= 0 && symmetryPermutationIndex < latticeStructure.permutations.size());
		const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;
		return latticeStructure.latticeVectors[permutation[neighborIndex]];
	}

	static const LatticeStructure& latticeStructure(int structureIndex){
		return _latticeStructures[structureIndex];
	}

	static void generateCellTooSmallError(int dimension);

private:
	double determineLocalStructure(NearestNeighborFinder& neighList, size_t particleIndex);
	static void initializeListOfStructures();

private:
	LatticeStructureType _inputCrystalType;
	bool _identifyPlanarDefects;
	ParticleProperty* _positions; 
	ParticleProperty* _structureTypes; 
	std::shared_ptr<ParticleProperty> _neighborLists; 
	std::shared_ptr<ParticleProperty> _atomClusters;
	std::shared_ptr<ParticleProperty> _atomSymmetryPermutations; 
	ParticleProperty* _particleSelection; 
	std::shared_ptr<ClusterGraph> _clusterGraph; 
	std::atomic<double> _maximumNeighborDistance;
	SimulationCell _simCell;
	std::vector<Matrix3> _preferredCrystalOrientations;
	double _cutoff;
    CNAMode _cnaMode;

	static CoordinationStructure _coordinationStructures[NUM_COORD_TYPES];
	static LatticeStructure _latticeStructures[NUM_LATTICE_TYPES];
};

}
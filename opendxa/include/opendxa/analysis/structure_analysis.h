#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/structures/cluster_graph.h>
#include <opendxa/structures/crystal_structure_types.h>
#include <opendxa/structures/neighbor_bond_array.h>
#include <opendxa/structures/coordination_structure.h>
#include <opendxa/structures/lattice_structure.h>
#include <nlohmann/json.hpp>
#include <opendxa/core/coordination_structures.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <mutex>

using json = nlohmann::json;

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

	void identifyStructures();
	void buildClusters();
	void connectClusters();
	void formSuperClusters();
	void determineLocalStructuresWithPTM();
	void computeMaximumNeighborDistanceFromPTM();
	void growClusterPTM(
		Cluster* cluster,
		std::deque<int>& atomsToVisit,
		int structureType
	);
	float computeAdaptiveRMSDCutoff();

	void buildClustersPTM();

	int atomCount() const{
		return positions()->size();
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
	
	ParticleProperty* positions() const{
		return _positions;
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

	const SimulationCell& cell() const{
		return _simCell;
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

	void calculateStructureStatistics() const {
        _structureStatistics.clear();
        
        const size_t N = positions()->size();
        for (size_t i = 0; i < N; ++i) {
            int structureType = _structureTypes->getInt(i);
            _structureStatistics[structureType]++;
        }
        
        _statisticsValid = true;
    }
    
    const std::map<int, int>& getStructureStatistics() const {
        if (!_statisticsValid) {
            calculateStructureStatistics();
        }
        return _structureStatistics;
    }
    
    std::map<std::string, int> getNamedStructureStatistics() const {
        if (!_statisticsValid) {
            calculateStructureStatistics();
        }
        
        std::map<std::string, int> namedStats;
        
        for (const auto& [structureType, count] : _structureStatistics) {
            std::string name = getStructureTypeName(structureType);
            namedStats[name] = count;
        }
        
        return namedStats;
    }
    
    void invalidateStatistics() {
        _statisticsValid = false;
    }
    
    std::string getStructureTypeName(int structureType) const {
        if (usingPTM()) {
            switch (static_cast<StructureType>(structureType)) {
                case StructureType::OTHER: return "OTHER";
                case StructureType::FCC: return "FCC";
                case StructureType::HCP: return "HCP";
                case StructureType::BCC: return "BCC";
                case StructureType::ICO: return "ICO";
                case StructureType::SC: return "SC";
                case StructureType::CUBIC_DIAMOND: return "CUBIC_DIAMOND";
                case StructureType::HEX_DIAMOND: return "HEX_DIAMOND";
                case StructureType::GRAPHENE: return "GRAPHENE";
                default: return "UNKNOWN";
            }
        } else {
            switch (static_cast<CoordinationStructureType>(structureType)) {
                case CoordinationStructureType::COORD_OTHER: return "OTHER";
                case CoordinationStructureType::COORD_FCC: return "FCC";
                case CoordinationStructureType::COORD_HCP: return "HCP";
                case CoordinationStructureType::COORD_BCC: return "BCC";
                case CoordinationStructureType::COORD_CUBIC_DIAMOND: return "CUBIC_DIAMOND";
                case CoordinationStructureType::COORD_HEX_DIAMOND: return "HEX_DIAMOND";
                default: return "UNKNOWN";
            }
        }
    }
    
    json getStructureStatisticsJson() const{
        if (!_statisticsValid) {
            calculateStructureStatistics();
        }
        
        json stats;
        stats["total_atoms"] = positions()->size();
        stats["analysis_method"] = usingPTM() ? "PTM" : "CNA";
        
        json typeStats;
        int totalIdentified = 0;
        
        for(const auto& [structureType, count] : _structureStatistics){
            std::string name = getStructureTypeName(structureType);
            
            json typeInfo;
            typeInfo["count"] = count;
            typeInfo["percentage"] = (count * 100.0) / positions()->size();
            typeInfo["type_id"] = structureType;
            
            typeStats[name] = typeInfo;
            
            if (structureType != static_cast<int>(StructureType::OTHER) && 
                structureType != static_cast<int>(CoordinationStructureType::COORD_OTHER)) {
                totalIdentified += count;
            }
        }
        
        stats["structure_types"] = typeStats;
        stats["summary"] = {
            {"total_identified", totalIdentified},
            {"total_unidentified", _structureStatistics.count(static_cast<int>(StructureType::OTHER)) ? _structureStatistics.at(static_cast<int>(StructureType::OTHER)) : 0},
            {"identification_rate", (totalIdentified * 100.0) / positions()->size()},
            {"unique_structure_types", static_cast<int>(_structureStatistics.size())}
        };
        
        return stats;
    }
private:
	bool alreadyProcessedAtom(int index);
	bool calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition);
	void connectClusterNeighbors(int atomIndex, Cluster* cluster1);
	bool areOrientationsCompatible(int atom1, int atom2);
	void storeDeformationGradient(const PTM::Kernel& kernel, size_t atomIndex);
	void storeOrientationData(const PTM::Kernel& kernel, size_t atomIndex);
	void storeNeighborIndices(const PTM::Kernel& kernel, size_t atomIndex);
	void initializeClustersForSuperclusterFormation();
	void processDefectClusters();
	void buildClustersCNA();
	void identifyStructuresCNA();
	void mergeCompatibleGrains(size_t oldTransitionCount, size_t newTransitionCount);
	std::pair<Cluster*, Cluster*> getParentGrains(ClusterTransition* transition);
	ClusterTransition* buildParentTransition(ClusterTransition* transition, Cluster* parent1, Cluster* parent2);
	void assignParentTransition(Cluster* parent1, Cluster* parent2, ClusterTransition* parentTransition);
	void finalizeParentGrains();
	Cluster* getParentGrain(Cluster* c);

	void processPTMAtom(
		PTM::Kernel& kernel,
		size_t atomIndex,
		StructureType type,
		const std::vector<uint64_t>& cached,
		float cutoff
	);
	void allocatePTMOutputArrays(size_t N);
	void initializePTMClusterOrientation(Cluster* cluster, size_t seedAtomIndex);
	void processAtomConnections(size_t atomIndex);
	std::tuple<int, const LatticeStructure&, const CoordinationStructure&, const std::array<int, 16>&> getAtomStructureInfo(int atomIndex);
	void processNeighborConnection(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, int structureType);
	void addReverseNeighbor(int neighbor, int atomIndex);
	void createNewClusterTransition(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, Cluster* cluster2);

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
	bool setupPTM(OpenDXA::PTM& ptm, size_t N);
	void filterAtomsByRMSD(
		const OpenDXA::PTM& ptm, 
		size_t N,
		const std::vector<StructureType>& ptmTypes,
		const std::vector<uint64_t>& cached,
		float cutoff
	);

	std::pair<std::vector<StructureType>, std::vector<uint64_t>> computeRawRMSD(const OpenDXA::PTM& ptm, size_t N);

	Cluster* startNewCluster(int atomIndex, int structureType);

	mutable std::map<int, int> _structureStatistics;
    mutable bool _statisticsValid = false;

	Mode _identificationMode;
	CoordinationStructures _coordStructures;
	LatticeStructureType _inputCrystalType;
	ParticleProperty* _positions; 
	std::mutex cluster_graph_mutex;
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
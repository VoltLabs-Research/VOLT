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
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/analysis/ptm_neighbor_finder.h>
#include <nlohmann/json.hpp>
#include <mutex>

using json = nlohmann::json;

namespace OpenDXA{

class StructureAnalysis{
public:
	enum Mode{
		CNA,
		PTM,
		DIAMOND,
	};

	StructureAnalysis(
		AnalysisContext& context,
		bool identifyPlanarDefects, 
		Mode identificationMode,
		float rmsd
	);

	void identifyStructures();

	void computeMaximumNeighborDistance();

	json getAtomsData(
		const LammpsParser::Frame &frame,
		const std::vector<int>* structureTypes
	);

	void identifyStructuresCNA();
	void computeMaximumNeighborDistanceFromPTM();
	void determineLocalStructuresWithPTM();

	int numberOfNeighbors(int atomIndex) const {
		assert(_context.neighborLists);
		const int* neighborList = _context.neighborLists->constDataInt() + (size_t)atomIndex * _context.neighborLists->componentCount();
		size_t count = 0;
		while(count < _context.neighborLists->componentCount() && neighborList[count] != -1){
			count++;
		}
		return count;
	}
	
	int getNeighbor(int centralAtomIndex, int neighborListIndex) const{
		assert(_context.neighborLists);
		return _context.neighborLists->getIntComponent(centralAtomIndex, neighborListIndex);
	}

	int findNeighbor(int centralAtomIndex, int neighborAtomIndex) const{
		assert(_context.neighborLists);
		const int* neighborList = _context.neighborLists->constDataInt() + (size_t)centralAtomIndex * _context.neighborLists->componentCount();
		for(size_t index = 0; index < _context.neighborLists->componentCount() && neighborList[index] != -1; index++){
			if(neighborList[index] == neighborAtomIndex){
				return index;
			}
		}
		return -1;
	}

	double maximumNeighborDistance() const{
		return _maximumNeighborDistance;
	}

	bool usingPTM() const{
		return _identificationMode == StructureAnalysis::Mode::PTM;
	}

	const AnalysisContext& context() const{
		return _context;
	}

	const ClusterGraph& clusterGraph() const{
		return *_clusterGraph;
	}

	ClusterGraph& clusterGraph(){
		return *_clusterGraph;
	}

	Cluster* atomCluster(int atomIndex) const{
		return clusterGraph().findCluster(_context.atomClusters->getInt(atomIndex));
	}
	
	void freeNeighborLists(){
		_context.neighborLists.reset();
		_context.atomSymmetryPermutations.reset();
	}

	void freePTMData(){
		_context.ptmRmsd.reset();
		_context.ptmOrientation.reset();
		_context.ptmDeformationGradient.reset();
		_context.correspondencesCode.reset();
		_context.templateIndex.reset();
	}

	void setIdentificationMode(Mode identificationMode){
		_identificationMode = identificationMode;
	}

	int findClosestSymmetryPermutation(int structureType, const Matrix3& rotation);

	// Returns the ideal lattice vector associated with a neighbor bond
	const Vector3& neighborLatticeVector(int centralAtomIndex, int neighborIndex) const{
		assert(_context.atomSymmetryPermutations);
		int structureType = _context.structureTypes->getInt(centralAtomIndex);
		const LatticeStructure& latticeStructure = CoordinationStructures::getLatticeStruct(structureType);
		assert(neighborIndex >= 0 && neighborIndex < CoordinationStructures::getCoordStruct(structureType).numNeighbors);
		int symmetryPermutationIndex = _context.atomSymmetryPermutations->getInt(centralAtomIndex);
		assert(symmetryPermutationIndex >= 0 && symmetryPermutationIndex < latticeStructure.permutations.size());
		const auto& permutation = latticeStructure.permutations[symmetryPermutationIndex].permutation;
		return latticeStructure.latticeVectors[permutation[neighborIndex]];
	}

	void calculateStructureStatistics() const {
        _structureStatistics.clear();
        
        const size_t N = _context.atomCount();
        for (size_t i = 0; i < N; ++i) {
            int structureType = _context.structureTypes->getInt(i);
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
				case StructureType::CUBIC_DIAMOND_FIRST_NEIGH: return "CUBIC_DIAMOND_FIRST_NEIGH";
				case StructureType::CUBIC_DIAMOND_SECOND_NEIGH: return "CUBIC_DIAMOND_SECOND_NEIGH";
				case StructureType::HEX_DIAMOND_FIRST_NEIGH: return "HEX_DIAMOND_FIRST_NEIGH";
				case StructureType::HEX_DIAMOND_SECOND_NEIGH: return "HEX_DIAMOND_SECOND_NEIGH";
                case StructureType::HEX_DIAMOND: return "HEX_DIAMOND";
                case StructureType::GRAPHENE: return "GRAPHENE";
                default: return "UNKNOWN";
            }
        } else {
            switch (structureType) {
                case static_cast<int>(CoordinationStructureType::COORD_OTHER): return "OTHER";
                case static_cast<int>(CoordinationStructureType::COORD_FCC): return "FCC";
                case static_cast<int>(CoordinationStructureType::COORD_HCP): return "HCP";
                case static_cast<int>(CoordinationStructureType::COORD_BCC): return "BCC";
                case static_cast<int>(CoordinationStructureType::COORD_CUBIC_DIAMOND): return "CUBIC_DIAMOND";
                case static_cast<int>(CoordinationStructureType::COORD_HEX_DIAMOND): return "HEX_DIAMOND";
                case static_cast<int>(StructureType::CUBIC_DIAMOND_FIRST_NEIGH): return "CUBIC_DIAMOND_FIRST_NEIGH";
				case static_cast<int>(StructureType::CUBIC_DIAMOND_SECOND_NEIGH): return "CUBIC_DIAMOND_SECOND_NEIGH";
				case static_cast<int>(StructureType::HEX_DIAMOND_FIRST_NEIGH): return "HEX_DIAMOND_FIRST_NEIGH";
				case static_cast<int>(StructureType::HEX_DIAMOND_SECOND_NEIGH): return "HEX_DIAMOND_SECOND_NEIGH";
                default: return "UNKNOWN";
            }
        }
    }
    
    json getStructureStatisticsJson() const{
		if(!_statisticsValid) calculateStructureStatistics();

		const int N = _context.atomCount();
		const double invN = (N > 0) ? (100.0 / static_cast<double>(N)) : 0.0;
		json stats = json::object();
		stats["total_atoms"] = N;

		json typeStats = json::object();
		int totalIdentified = 0;

		constexpr int K = static_cast<int>(StructureType::NUM_STRUCTURE_TYPES);
		std::vector<std::string> nameCache(K);
		std::vector<char> hasName(K, 0);

		auto getNameCached = [&](int st) -> const std::string& {
			const int idx = (0 <= st && st < K) ? st : static_cast<int>(StructureType::OTHER);
			if(!hasName[idx]){
				nameCache[idx] = getStructureTypeName(idx);
				hasName[idx] = 1;
			}
			return nameCache[idx];
		};

		for(const auto& [structureType, count] : _structureStatistics){
			const std::string& name = getNameCached(structureType);

			json& typeInfo = typeStats[name];
			typeInfo = json::object();
			typeInfo["count"] = count;
			typeInfo["percentage"] = static_cast<double>(count) * invN;
			typeInfo["type_id"] = structureType;

			if(structureType != static_cast<int>(StructureType::OTHER) &&
				structureType != static_cast<int>(CoordinationStructureType::COORD_OTHER)){
				totalIdentified += count;
			}
		}

		int unidentified = 0;
		auto itOther = _structureStatistics.find(static_cast<int>(StructureType::OTHER));
		if(itOther != _structureStatistics.end()){
			unidentified = itOther->second;
		}

		stats["structure_types"] = std::move(typeStats);
		stats["summary"] = {
			{"total_identified", totalIdentified},
			{"total_unidentified", unidentified},
			{"identification_rate", static_cast<double>(totalIdentified) * invN},
			{"unique_structure_types", static_cast<int>(_structureStatistics.size())}
		};

		return stats;
	}

private:
	void storeDeformationGradient(const PTM::Kernel& kernel, size_t atomIndex);
	void storeOrientationData(const PTM::Kernel& kernel, size_t atomIndex);
	void storeNeighborIndices(const PTM::Kernel& kernel, size_t atomIndex);

	void processPTMAtom(
		PTM::Kernel& kernel,
		size_t atomIndex,
		StructureType type,
		const std::vector<uint64_t>& cached,
		float cutoff
	);

	bool setupPTM(OpenDXA::PTM& ptm, size_t N);

	mutable std::map<int, int> _structureStatistics;
    mutable bool _statisticsValid = false;

	Mode _identificationMode;
	AnalysisContext& _context;
	CoordinationStructures _coordStructures;
	std::mutex cluster_graph_mutex;
	
	float _rmsd;

	std::shared_ptr<ClusterGraph> _clusterGraph; 
	std::atomic<double> _maximumNeighborDistance;
};

}

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

	void setIdentificationMode(Mode identificationMode){
		_identificationMode = identificationMode;
	}


	const Vector3& neighborLatticeVector(int centralAtomIndex, int neighborIndex) const{
		assert(_context.atomSymmetryPermutations);
		int structureType = _context.structureTypes->getInt(centralAtomIndex);
		const LatticeStructure& latticeStructure = CoordinationStructures::_latticeStructures[structureType];
		assert(neighborIndex >= 0 && neighborIndex < CoordinationStructures::_coordinationStructures[structureType].numNeighbors);
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
        if (!_statisticsValid) {
            calculateStructureStatistics();
        }
        
        json stats;
        stats["total_atoms"] = _context.atomCount();
		// TODO: Create a private method with a switch for handle this.
        stats["analysis_method"] = _identificationMode == StructureAnalysis::Mode::DIAMOND ? "DIAMOND" : usingPTM() ? "PTM" : "CNA";
        
        json typeStats;
        int totalIdentified = 0;
        
        for(const auto& [structureType, count] : _structureStatistics){
            std::string name = getStructureTypeName(structureType);
            
            json typeInfo;
            typeInfo["count"] = count;
            typeInfo["percentage"] = (count * 100.0) / _context.atomCount();
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
            {"identification_rate", (totalIdentified * 100.0) / _context.atomCount()},
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
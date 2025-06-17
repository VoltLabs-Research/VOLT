#ifndef OPENDXA_CLUSTERING_H
#define OPENDXA_CLUSTERING_H

#include <opendxa/includes.hpp>
#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/utils/memory_pool.hpp>
#include <opendxa/structures/structures.hpp>
#include <opendxa/core/neighbor_list_builder.hpp>
#include <opendxa/logger/logger.hpp>
#include <opendxa/structures/cluster/cluster.hpp>
#include <opendxa/structures/cluster/cluster_transition.hpp>
#include <nlohmann/json.hpp>
#include <climits>
#include <limits>
#include <stack>

#include "ptm_functions.h"
#include "ptm_initialize_data.h"

using json = nlohmann::json;

enum ParserFileType{
	PARSER_FILETYPE_LAMMPS,
};

class Clustering : public AnalysisEnvironment{
public:
	Clustering();
	~Clustering() { cleanup(); }
	void setCNACutoff(FloatType cutoff);
	FloatType getCNACutoff() const { return cnaCutoff; }
	ParserFileType readAtomsFile(ParserStream& stream, bool shouldIgnoreInvalidFile);
	void transformSimulationCell(const Matrix3& tm);
	void wrapInputAtoms(const Vector3 offset = NULL_VECTOR);
	void buildNearestNeighborLists();
	
	void performCNA();
	void performPTM();

	void clusterAtoms();
	void orderCrystallineAtoms();
	void determineDistanceFromDefects();
	void clusterCrystallineAtoms(int level);
	void createClusterTransitions();
	void createSuperclusters(vector<ClusterTransition*>& clusterTransitions);
	void alignClusterOrientations();
	json getAtomsData();
    vector<InputAtom>& getInputAtoms() { return inputAtoms; }
	void cleanup();
	const vector<InputAtom>& getInputAtoms() const { return inputAtoms; }

	NeighborListBuilder<InputAtom> neighborListBuilder;

protected:
	void readLAMMPSAtomsFile(ParserStream& stream);
	InputAtom& addInputAtom(const Point3& pos, int id);

	void orderFCCAtomNeighbors(InputAtom* atom);
	void orderHCPAtomNeighbors(InputAtom* atom);
	void orderBCCAtomNeighbors(InputAtom* atom);

	void finalizeSuperclusters();
	void clusterNeighbor(InputAtom* currentAtom, InputAtom* neighbor, const LatticeOrientation& neighborLatticeOrientation, deque<InputAtom*>& toprocess, int level);
	bool isValidClusterNeighbor(InputAtom* currentAtom, int neighborIndex, int level);
	void disableDisclinationBorderAtom(InputAtom* atom);

	ClusterTransition* createClusterTransition(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM);
	ClusterTransition* createClusterTransitionOnDemand(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM);
	ClusterTransition* getClusterTransition(Cluster* cluster1, Cluster* cluster2, const LatticeOrientation& transitionTM) const {
		ClusterTransition* t12 = cluster1->transitions;
		while(t12 != NULL) {
			if(t12->cluster2 == cluster2 && t12->transitionTM.equals(transitionTM))
				return t12;
			t12 = t12->next;
		}
		return NULL;
	}

	Cluster* createCluster(int id, int processor);
	Cluster* createClusterOnDemand(int id, int processor);
	Cluster* getCluster(int id) const {
		if(id < 0) return NULL;
		map<int, Cluster*>::const_iterator i = clusters.find(id);
		if(i == clusters.end()) return NULL;
		return i->second;
	}
	void joinClusters(ClusterTransition* transition, list<ClusterTransition*>& priorityStack);

	ptm_local_handle_t ptmLocalHandle;
	FloatType cnaCutoff;
	vector<InputAtom> inputAtoms;
	int numLocalInputAtoms;
	vector<InputAtom>::iterator firstGhostAtom;
	int numClusters;
	int numDisclinationAtoms;
	int numClusterDisclinations;
	int numSuperClusters;
	int numClusterTransitions;
	map<int, Cluster*> clusters;
	MemoryPool<Cluster> clusterPool;
	MemoryPool<ClusterTransition> clusterTransitionPool;
};

#endif


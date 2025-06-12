#ifndef __DXA_CLUSTERING_H
#define __DXA_CLUSTERING_H

#include <opendxa/includes.hpp>
#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/utils/memory_pool.hpp>
#include <opendxa/structures/structures.hpp>
#include <opendxa/core/neighbor_list_builder.hpp>
#include <opendxa/logger/logger.hpp>

enum ParserFileType{
	PARSER_FILETYPE_LAMMPS,
};

class DXAClustering : public AnalysisEnvironment{
public:
	DXAClustering();
	~DXAClustering() { cleanup(); }
	void setCNACutoff(FloatType cutoff);
	FloatType getCNACutoff() const { return cnaCutoff; }
	ParserFileType readAtomsFile(ParserStream& stream);
	void transformSimulationCell(const Matrix3& tm);
	void wrapInputAtoms(const Vector3 offset = NULL_VECTOR);
	void buildNearestNeighborLists();
	void performCNA();
	void clusterAtoms();
	void orderCrystallineAtoms();
	void determineDistanceFromDefects();
	void clusterCrystallineAtoms(int level);
	void createClusterTransitions();
	void createSuperclusters(vector<ClusterTransition*>& clusterTransitions);
	void alignClusterOrientations();
	void writeAtomsDumpFile(ostream& stream);

	void cleanup();
	const vector<InputAtom>& getInputAtoms() const { return inputAtoms; }

protected:
	void readLAMMPSAtomsFile(ParserStream& stream);
	InputAtom& addInputAtom(const Point3& pos, int id);

	void orderFCCAtomNeighbors(InputAtom* atom);
	void orderHCPAtomNeighbors(InputAtom* atom);
	void orderBCCAtomNeighbors(InputAtom* atom);

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

	FloatType cnaCutoff;
	vector<InputAtom> inputAtoms;
	int numLocalInputAtoms;
	vector<InputAtom>::iterator firstGhostAtom;
	NeighborListBuilder<InputAtom> neighborListBuilder;
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


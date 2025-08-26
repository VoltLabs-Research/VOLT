#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/structure_analysis.h>

namespace OpenDXA{

class ClusterConnector{
public:
    ClusterConnector(
        StructureAnalysis& sa,
        AnalysisContext& context
    );

	void buildClusters();
	void connectClusters();
	void formSuperClusters();

private:
	void initializeClustersForSuperclusterFormation();
	void processDefectClusters();
	bool areOrientationsCompatible(int atom1, int atom2, int structureType);
	void connectClusterNeighbors(int atomIndex, Cluster* cluster1);
	void processAtomConnections(size_t atomIndex);
	void buildClustersPTM();
	void buildClustersCNA();
	void growClusterPTM(Cluster* cluster, std::deque<int>& atomsToVisit, int structureType);
	void initializePTMClusterOrientation(Cluster* cluster, size_t seedAtomIndex);

	void growCluster(
		Cluster* cluster,
		std::deque<int>& atomsToVisit,
		Matrix_3<double>& orientationV,
		Matrix_3<double>& orientationW,
		int structureType
	);

	void mergeCompatibleGrains(size_t oldTransitionCount, size_t newTransitionCount);
	void finalizeParentGrains();
	void assignParentTransition(Cluster* parent1, Cluster* parent2, ClusterTransition* parentTransition);
    
    bool alreadyProcessedAtom(int index);
	bool calculateMisorientation(int atomIndex, int neighbor, int neighborIndex, Matrix3& outTransition);
    Quaternion getPTMAtomOrientation(int atom) const;

	std::pair<Cluster*, Cluster*> getParentGrains(ClusterTransition* transition);
	ClusterTransition* buildParentTransition(ClusterTransition* transition, Cluster* parent1, Cluster* parent2);
	Cluster* startNewCluster(int atomIndex, int structureType);
	Cluster* getParentGrain(Cluster* c);

	Matrix3 quaternionToMatrix(const Quaternion& q);

	void processNeighborConnection(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, int structureType);
	void addReverseNeighbor(int neighbor, int atomIndex);
	void createNewClusterTransition(int atomIndex, int neighbor, int neighborIndex, Cluster* cluster1, Cluster* cluster2);

	void processDefectCluster(Cluster* defectCluster);
	void reorientAtomsToAlignClusters();
	void applyPreferredOrientation(Cluster* cluster);

    AnalysisContext& _context;
    StructureAnalysis& _sa;
};

}
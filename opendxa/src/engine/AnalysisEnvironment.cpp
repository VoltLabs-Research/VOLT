#include "engine/AnalysisEnvironment.hpp"
#include "core/Clustering.hpp"
#include "core/InterfaceMesh.hpp"
#include "core/DislocationTracing.hpp"
#include "core/StackingFaults.hpp"
#include "logger/Logger.hpp"

AnalysisEnvironment::AnalysisEnvironment(){
	timestep = 0;
	pbc[0] = pbc[1] = pbc[2] = true;
	simulationCell = NULL_MATRIX;
	simulationCellOrigin = ORIGIN;
	processor = 0;
}

void AnalysisEnvironment::raiseError(const char* format, ...){
	va_list ap;
	va_start(ap,format);
	char buffer[4096];
	vsprintf(buffer, format, ap);
	va_end(ap);

	throw runtime_error(buffer);
}

DXAClustering::DXAClustering(): AnalysisEnvironment(){
	cnaCutoff = 0;
	numLocalInputAtoms = 0;
	numClusters = 0;
	numClusterDisclinations = 0;
	numSuperClusters = 0;
	numClusterTransitions = 0;
}

DXAInterfaceMesh::DXAInterfaceMesh(): DXAClustering(){}

DXATracing::DXATracing(): DXAInterfaceMesh(), unusedCircuit(NULL){
	this->burgersSearchDepth = (DEFAULT_MAX_BURGERS_CIRCUIT_SIZE - 1) / 2;
	this->maxBurgersCircuitSize = DEFAULT_MAX_BURGERS_CIRCUIT_SIZE;	this->maxExtendedBurgersCircuitSize = DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE;
}

DXAStackingFaults::DXAStackingFaults(): DXATracing(){}

void DXAClustering::cleanup(){
	inputAtoms.clear();
	numClusters = 0;
	numLocalInputAtoms = 0;
	numClusterDisclinations = 0;
	numSuperClusters = 0;
	numClusterTransitions = 0;
	clusters.clear();
	clusterPool.clear();
	clusterTransitionPool.clear();
}

void DXAInterfaceMesh::cleanup(){
	DXAClustering::cleanup();
	nodes.clear();
	nodePool.clear();
	facets.clear();
	facetPool.clear();
	outputMesh.clear();
	outputMeshCap.clear();
}

void DXATracing::cleanup(){
	DXAInterfaceMesh::cleanup();

	segments.clear();
	segmentPool.clear();
	danglingCircuits.clear();
	circuitPool.clear();
	unusedCircuit = NULL;
}

void DXAStackingFaults::cleanup(){
	DXATracing::cleanup();
	stackingFaults.clear();
	stackingFaultPool.clear();
	stackingFaultVertexPool.clear();
	stackingFaultOutputMesh.clear();
}

void DXAClustering::setCNACutoff(FloatType cutoff){
	this->cnaCutoff = cutoff;
}



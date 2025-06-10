#include "engine/DislocationExtractionAlgorithm.hpp"
#include "core/Clustering.hpp"
#include "core/InterfaceMesh.hpp"
#include "core/DislocationTracing.hpp"
#include "core/StackingFaults.hpp"

DXABase::DXABase(ostream& _msgLogger, ostream& _verboseLogger) :
	msgLogger(&_msgLogger), verboseLogger(&_verboseLogger){
	timestep = 0;
	pbc[0] = pbc[1] = pbc[2] = true;
	simulationCell = NULL_MATRIX;
	simulationCellOrigin = ORIGIN;
	processor = 0;
}

void DXABase::raiseError(const char* format, ...){
	va_list ap;
	va_start(ap,format);
	char buffer[4096];
	vsprintf(buffer, format, ap);
	va_end(ap);

	throw runtime_error(buffer);
}

DXAClustering::DXAClustering(ostream& msgLogger, ostream& verboseLogger)
	: DXABase(msgLogger, verboseLogger){
	cnaCutoff = 0;
	numLocalInputAtoms = 0;
	numClusters = 0;
	numClusterDisclinations = 0;
	numSuperClusters = 0;
	numClusterTransitions = 0;
}

DXAInterfaceMesh::DXAInterfaceMesh(ostream& msgLogger, ostream& verboseLogger)
	: DXAClustering(msgLogger, verboseLogger){}

DXATracing::DXATracing(ostream& msgLogger, ostream& verboseLogger)
	: DXAInterfaceMesh(msgLogger, verboseLogger), unusedCircuit(NULL){
	this->burgersSearchDepth = (DEFAULT_MAX_BURGERS_CIRCUIT_SIZE - 1) / 2;
	this->maxBurgersCircuitSize = DEFAULT_MAX_BURGERS_CIRCUIT_SIZE;	this->maxExtendedBurgersCircuitSize = DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE;
}

DXAStackingFaults::DXAStackingFaults(ostream& msgLogger, ostream& verboseLogger)
	: DXATracing(msgLogger, verboseLogger){}

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



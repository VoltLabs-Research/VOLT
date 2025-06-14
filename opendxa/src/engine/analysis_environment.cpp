#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/core/clustering.hpp>
#include <opendxa/core/interface_mesh.hpp>
#include <opendxa/core/dislocation_tracing.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/logger/logger.hpp>

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

DXAClustering::DXAClustering()
		: cnaCutoff(0.0),
		numLocalInputAtoms(0),
		numClusters(0),
		numDisclinationAtoms(0),
		numClusterDisclinations(0),
		numSuperClusters(0),
		numClusterTransitions(0){
	// TODO: Should I keep this? Could I somehow estimate this 
	// parameter based on the simulation being evaluated? 
	// Should it be a configurable parameter?
	constexpr size_t expectedAtoms = 40000;
	inputAtoms.reserve(expectedAtoms);
}

DXAInterfaceMesh::DXAInterfaceMesh(): DXAClustering(){}

DXATracing::DXATracing(): DXAInterfaceMesh(), unusedCircuit(nullptr){
	// TODO: Should I readjust these variables or follow the user's instructions?
	burgersSearchDepth = (DEFAULT_MAX_BURGERS_CIRCUIT_SIZE - 1) / 2;
	maxBurgersCircuitSize = DEFAULT_MAX_BURGERS_CIRCUIT_SIZE;
	maxExtendedBurgersCircuitSize = DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE;

	const std::size_t expectedCircuits = 4 * nodes.size();
	const std::size_t expectedSegments = expectedCircuits / 2 + 1024;

	circuitPool.reserve(expectedCircuits);
	segmentPool.reserve(expectedSegments);
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
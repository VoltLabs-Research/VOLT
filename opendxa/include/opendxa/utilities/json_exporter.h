#pragma once
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <numeric>
#include <cmath>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/analysis/burgers_circuit.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/math/lin_alg.h>
#include <opendxa/analysis/atomic_strain.h>

namespace OpenDXA{

using json = nlohmann::json;

class ElasticStrainEngine;

class DXAJsonExporter{
public:
    explicit DXAJsonExporter(const std::string& filename = "")
        : _filename(filename), _startTime(std::chrono::high_resolution_clock::now()) {}

    json exportAnalysisData(
        const DislocationNetwork* network,
        const HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& defectMesh,
        const InterfaceMesh* interfaceMesh,
        const LammpsParser::Frame& frame,
        const BurgersLoopBuilder* tracer,
        const std::vector<int>* structureTypes = nullptr,
        bool includeDetailedNetworkInfo = true,
    bool includeTopologyInfo = true,
    bool includeDislocationsInMemory = true,
    bool includeAtomsInMemory = true
    );

    json exportClusterGraphToJson(const ClusterGraph* graph);
    json exportDislocationsToJson(const DislocationNetwork* network, bool includeDetailedInfo = false, const SimulationCell* simulationCell = nullptr);
    // Streaming writers: write directly to MessagePack to avoid large in-memory JSON
    bool writeAtomsMsgpack(const LammpsParser::Frame& frame,
                           const BurgersLoopBuilder* tracer,
                           const std::vector<int>* structureTypes,
                           const std::string& filepath,
                           int threadCount = 1);

    bool writeAtomsSimpleMsgpack(const LammpsParser::Frame& frame,
                                 const StructureAnalysis& structureAnalysis,
                                 const std::vector<int>* structureTypes,
                                 const std::string& filepath);

    bool writeDislocationsMsgpack(const DislocationNetwork* network,
                                  const SimulationCell* simulationCell,
                                  const std::string& filepath,
                                  bool includeDetailedInfo = false,
                                  int threadCount = 1);

    bool writeInterfaceMeshMsgpack(const InterfaceMesh* interfaceMesh,
                                   const std::string& filepath,
                                   bool includeTopologyInfo = true);

    bool writeDefectMeshMsgpack(const HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& defectMesh,
                                const StructureAnalysis& structureAnalysis,
                                const std::string& filepath);

    bool writeStructureStatsMsgpack(const StructureAnalysis& structureAnalysis,
                                    const std::string& filepath);

    bool writeSimulationCellMsgpack(const SimulationCell& cell,
                                    const std::string& filepath);

    bool writeRdfMsgpack(const std::vector<double>& rdfX,
                         const std::vector<double>& rdfY,
                         const std::string& filepath);

    bool writeAtomicStrainMsgpack(const AtomicStrainModifier::AtomicStrainEngine& engine,
                                  const std::vector<int>& ids,
                                  const std::string& filepath);

    bool writeElasticStrainMsgpack(const ElasticStrainEngine& engine,
                                   const std::vector<int>& ids,
                                   const std::string& filepath);

    json getInterfaceMeshData(
        const InterfaceMesh* interfaceMesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo
    );
    
    json getAtomsData(const LammpsParser::Frame& frame, const BurgersLoopBuilder* tracer, const std::vector<int>* structureTypes = nullptr);
    json getProcessingTime();
    json getMetadata();
    
    json getNetworkStatistics(const DislocationNetwork* network, double cellVolume);
    json getJunctionInformation(const DislocationNetwork* network);
    json getCircuitInformation(const DislocationNetwork* network);
    json getTopologyInformation(const InterfaceMesh* interfaceMesh);
    json getExtendedSimulationCellInfo(const SimulationCell& cell);
    
    void setFilename(const std::string& filename){
        _filename = filename;
    }

    bool saveToFile(const json& data, const std::string& filepath);

private:
    std::string _filename;
    std::chrono::high_resolution_clock::time_point _startTime;

    template <typename MeshType>
    json getMeshData(
        const MeshType& mesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo,
        const InterfaceMesh* interfaceMeshForTopology
    );
    
    json pointToJson(const Point3& point);
    json vectorToJson(const Vector3& vector);
    json matrixToJson(const Matrix3& matrix);
    json affineTransformationToJson(const AffineTransformation& transform);
    json simulationCellToJson(const SimulationCell& cell);
    
    json segmentToJson(const DislocationSegment* segment, bool includeDetailedInfo = false);
    json nodeToJson(const DislocationNode* node);
    json circuitToJson(const BurgersCircuit* circuit);
    
    std::string getBurgersVectorString(const Vector3& burgers);
    std::string getLineDirectionString(const Vector3& direction);
    
    int countJunctions(const DislocationNetwork* network);
    int countDanglingSegments(const DislocationNetwork* network);
    double calculateAverageVertexDegree(const InterfaceMesh* interfaceMesh);
    double calculateAngle(const Vector3& a, const Vector3& b);
};

// TODO: ?
json dislocationNetworkToJson(const DislocationNetwork* network);
json frameToJson(const LammpsParser::Frame& frame);

} 
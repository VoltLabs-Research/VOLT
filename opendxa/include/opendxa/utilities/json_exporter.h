#pragma once
#include <nlohmann/json.hpp>
#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <numeric>
#include <cmath>
#include <unordered_set>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/analysis/burgers_circuit.h>
#include <opendxa/core/lammps_parser.h>
#include <opendxa/math/lin_alg.h>
#include <opendxa/analysis/atomic_strain.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/compute_displacements.h>
#include <opendxa/analysis/cluster_analysis.h>

namespace OpenDXA{

using json = nlohmann::json;

class ElasticStrainEngine;
class MsgpackWriter;
class BurgersLoopBuilder;

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

    void exportForStructureIdentification(
        const LammpsParser::Frame& frame,
        const StructureAnalysis& structureAnalysis,
        const std::string& outputFilename
    );;

    json exportClusterGraphToJson(const ClusterGraph* graph);
    json exportDislocationsToJson(const DislocationNetwork* network, bool includeDetailedInfo = false, const SimulationCell* simulationCell = nullptr);
    static inline uint32_t checked_u32_size(std::size_t n){
        if(n > static_cast<std::size_t>(std::numeric_limits<uint32_t>::max())){
            throw std::runtime_error("JSON container too large for msgpack u32 header.");
        }
        return static_cast<uint32_t>(n);
    }

    bool writeJsonMsgpackToFile(const json& data, const std::string& filePath, bool sortKeys = true);

    json getDisplacementsData(
        const ComputeDisplacements& engine,
        const std::vector<int>& ids
    );

    json getInterfaceMeshData(
        const InterfaceMesh* interfaceMesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo
    );
    
    json getAtomsData(const LammpsParser::Frame& frame, const BurgersLoopBuilder* tracer, const std::vector<int>* structureTypes = nullptr);
    json getAtomicStrainData(const AtomicStrainModifier::AtomicStrainEngine& engine, const std::vector<int>& ids);
    json getElasticStrainData(const ElasticStrainEngine& engine, const std::vector<int>& ids);
    json getPTMData(const AnalysisContext& context, const std::vector<int>& ids);
    void exportPTMData(const AnalysisContext& context, const std::vector<int>& ids, const std::string& outputFilename);
    json getProcessingTime();
    json getMetadata();

    json getClusterAnalysisData(
        const ClusterAnalysis::ClusterAnalysisEngine& engine,
        const std::vector<int>& ids
    );
    
    json getNetworkStatistics(const DislocationNetwork* network, double cellVolume);
    json getJunctionInformation(const DislocationNetwork* network);
    json getCircuitInformation(const DislocationNetwork* network);
    json getTopologyInformation(const InterfaceMesh* interfaceMesh);
    json getExtendedSimulationCellInfo(const SimulationCell& cell);
    
    void setFilename(const std::string& filename){
        _filename = filename;
    }

    void exportCoreAtoms(
        const LammpsParser::Frame& frame,
        const std::unordered_set<int>& coreAtomIndices,
        const std::string& outputFilename
    );

    bool saveToFile(const json& data, const std::string& filepath);

    template <typename MeshType>
    json getMeshData(
        const MeshType& mesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo,
        const InterfaceMesh* interfaceMeshForTopology
    );

    template <typename MeshType>
    void writeMeshMsgpackToFile(
        const MeshType& mesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo,
        const InterfaceMesh* interfaceMeshForTopology,
        const std::string& filePath
    );

    void writeDefectMeshMsgpackToFile(
        const InterfaceMesh& interfaceMesh,
        const BurgersLoopBuilder& tracer,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo,
        const std::string& filePath
    );

private:
    std::string _filename;
    std::chrono::high_resolution_clock::time_point _startTime;


    
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

    void writeJsonAsMsgpack(MsgpackWriter& writer, const json& data, bool sortKeys = true);
};

// TODO: ?
json dislocationNetworkToJson(const DislocationNetwork* network);
json frameToJson(const LammpsParser::Frame& frame);

} 

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

namespace OpenDXA{

using json = nlohmann::json;

struct GLTFExportOptions{
    int maxAtoms = -1;
    float subsampleRatio = 1.0f; 
    bool enableLOD = false;  
    float lodThreshold = 1000.0f;  
    bool spatialCulling = false;  
    float cullRadius = 50.0f;   
    Vector3 cullCenter = {0,0,0};  
    int maxInstancesPerMesh = 65536; 
};

class DXAJsonExporter{
public:
    explicit DXAJsonExporter(const std::string& filename = "")
        : _filename(filename), _startTime(std::chrono::high_resolution_clock::now()) {}

    json exportAnalysisData(
        const DislocationNetwork* network,
        const InterfaceMesh* interfaceMesh,
        const LammpsParser::Frame& frame,
        const BurgersLoopBuilder* tracer,
        const std::vector<int>* structureTypes = nullptr,
        bool includeDetailedNetworkInfo = true,
        bool includeTopologyInfo = true
    );

    void exportAtomsToGLTF(
        const LammpsParser::Frame& frame,
        const BurgersLoopBuilder* tracer,
        const std::vector<int>* structureTypes,
        const std::string& filename,
        float atomRadius,
        const GLTFExportOptions& options = GLTFExportOptions{}
    );

    json exportClusterGraphToJson(const ClusterGraph* graph);
    json exportDislocationsToJson(const DislocationNetwork* network, bool includeDetailedInfo = false, const SimulationCell* simulationCell = nullptr);
    json getInterfaceMeshData(
        const InterfaceMesh* interfaceMesh,
        const StructureAnalysis& structureAnalysis,
        bool includeTopologyInfo
    );
    
    json getAtomsData(const LammpsParser::Frame& frame, const BurgersLoopBuilder* tracer, const std::vector<int>* structureTypes = nullptr);
    json getProcessingTime();
    json getMetadata();
    
    void exportAtomsToVTK(
        const LammpsParser::Frame& frame,
        const BurgersLoopBuilder* tracer,
        const std::vector<int>* structureTypes,
        const std::string& filename
    );

    json getNetworkStatistics(const DislocationNetwork* network, double cellVolume);
    json getJunctionInformation(const DislocationNetwork* network);
    json getCircuitInformation(const DislocationNetwork* network);
    json getTopologyInformation(const InterfaceMesh* interfaceMesh);
    json getExtendedSimulationCellInfo(const SimulationCell& cell);
    void exportInterfaceMeshToVTK(
        const InterfaceMesh& interfaceMesh, 
        const StructureAnalysis& structureAnalysis,
        const std::string& filename = "interface_mesh.vtk"); 

    
    void exportDislocationsToVTK(
        const DislocationNetwork* network,
        const SimulationCell& cell,
        const std::string& filename);

    void setFilename(const std::string& filename){
        _filename = filename;
    }

    bool saveToFile(const json& data, const std::string& filepath);

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
};

// TODO: ?
json dislocationNetworkToJson(const DislocationNetwork* network);
json frameToJson(const LammpsParser::Frame& frame);

} 
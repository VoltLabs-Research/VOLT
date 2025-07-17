#include <opendxa/utilities/json_exporter.h>
#include <opendxa/analysis/burgers_circuit.h>
#include <opendxa/analysis/burgers_loop_builder.h>
#include <fstream>
#include <iomanip>
#include <filesystem>
#include <set>
#include <climits>
#include <unordered_set>
#include <algorithm>
#include <cmath>

class Base64Utils{
private:
    static const std::string chars;
    
public:
    static std::string encode(const uint8_t* data, size_t len);
    static std::vector<uint8_t> decode(const std::string& encoded);
};

const std::string Base64Utils::chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string Base64Utils::encode(const uint8_t* data, size_t len) {
    std::string result;
    result.reserve(((len + 2) / 3) * 4);
    
    for (size_t i = 0; i < len; i += 3) {
        uint32_t tmp = data[i] << 16;
        if (i + 1 < len) tmp |= data[i + 1] << 8;
        if (i + 2 < len) tmp |= data[i + 2];
        
        result += chars[(tmp >> 18) & 0x3F];
        result += chars[(tmp >> 12) & 0x3F];
        result += (i + 1 < len) ? chars[(tmp >> 6) & 0x3F] : '=';
        result += (i + 2 < len) ? chars[tmp & 0x3F] : '=';
    }
    
    return result;
}

std::vector<uint8_t> Base64Utils::decode(const std::string& encoded) {
    std::vector<uint8_t> result;
    if (encoded.length() % 4 != 0) return result;
    
    auto getValue = [](char c) -> int {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '+') return 62;
        if (c == '/') return 63;
        return -1;
    };
    
    for (size_t i = 0; i < encoded.length(); i += 4) {
        uint32_t tmp = 0;
        int padding = 0;
        
        for (int j = 0; j < 4; j++) {
            if (encoded[i + j] == '=') {
                padding++;
            } else {
                tmp = (tmp << 6) | getValue(encoded[i + j]);
            }
        }
        
        if (padding < 4) result.push_back((tmp >> 16) & 0xFF);
        if (padding < 3) result.push_back((tmp >> 8) & 0xFF);
        if (padding < 2) result.push_back(tmp & 0xFF);
    }
    
    return result;
}

inline std::string base64_encode(const uint8_t* data, size_t len) {
    return Base64Utils::encode(data, len);
}

namespace OpenDXA {

// To determine the type of dislocation (screw, edge, or mixed) we must classify the 
// cosine of the angle theta between the Burgers vector and the tangent vector using the dot product formula.
std::string getDislocationType(const DislocationSegment* segment){
    try{
        if(!segment || segment->isDegenerate() || segment->line.size() < 2){
            return "unknown";
        }

        // Get Burgers vector
        Vector3 burgersVector = segment->burgersVector.localVec();

        // Calculate the tangent vector (from the first to the last point)
        Vector3 tangentVector = segment->line.back() - segment->line.front();

        // Calculate the norms (magnitudes) of vectors
        double normBurgers = burgersVector.length();
        double normTangent = tangentVector.length();

        // If any of the vectors have length zero, the type is indeterminate.
        // We use a small epsilon to avoid problems with floating-point precision.
        if(normBurgers < EPSILON || normTangent < EPSILON){
            return "unknown";
        }

        // // Normalize both vectors (convert them to unit vectors)
        Vector3 burgersNorm = burgersVector.normalized();
        Vector3 tangentNorm = tangentVector.normalized();

        // Calculate the cosine of the angle using the dot product.
        // We take the absolute value to handle opposite directions
        double cosTheta = std::abs(tangentNorm.dot(burgersNorm));

        constexpr double COS_SCREW_THRESHOLD = 0.9;
        constexpr double COS_EDGE_THRESHOLD  = 0.1;

        if (cosTheta > COS_SCREW_THRESHOLD) return "screw";
        if (cosTheta < COS_EDGE_THRESHOLD)  return "edge";
        
        return "mixed";
    }catch(const std::exception&){
        return "unknown";
    }
}

void DXAJsonExporter::exportAtomsToGLTF(
    const LammpsParser::Frame& frame,
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes,
    const std::string& filename,
    float atomRadius,
    const GLTFExportOptions& options
) {
    json gltf;

    // --- GLTF Header ---
    gltf["asset"] = {
        {"version", "2.0"},
        {"generator", "OpenDXA GLTF Exporter - Optimized"},
        {"copyright", "Generated from DXA analysis"}
    };
    gltf["extensionsUsed"] = json::array({"EXT_mesh_gpu_instancing"});
    gltf["extensionsRequired"] = json::array({"EXT_mesh_gpu_instancing"});
    gltf["scene"] = 0;
    gltf["scenes"] = json::array({ {{"nodes", json::array()}} });

    std::vector<json> nodes;
    std::vector<json> meshes;
    std::vector<json> materials;
    std::vector<json> accessors;
    std::vector<json> bufferViews;
    std::vector<uint8_t> bufferData;

    std::map<int, std::vector<float>> lammpsTypeColors = {
        // Gray
        {0, {0.5f, 0.5f, 0.5f, 1.0f}},
        // Red
        {1, {1.0f, 0.267f, 0.267f, 1.0f}},
        // Green
        {2, {0.267f, 1.0f, 0.267f, 1.0f}},
        // Blue
        {3, {0.267f, 0.267f, 1.0f, 1.0f}},
        // Yellow 
        {4, {1.0f, 1.0f, 0.267f, 1.0f}},   
        // Magenta
        {5, {1.0f, 0.267f, 1.0f, 1.0f}},   
        // Cyan
        {6, {0.267f, 1.0f, 1.0f, 1.0f}}  
    };

    std::vector<int> selectedAtoms;
    selectedAtoms.reserve(frame.natoms);
    
    for (int i = 0; i < frame.natoms; ++i) {
        bool includeAtom = true;
        
        if (options.spatialCulling) {
            const auto& pos = frame.positions[i];
            double dx = pos.x() - options.cullCenter.x();
            double dy = pos.y() - options.cullCenter.y();
            double dz = pos.z() - options.cullCenter.z();
            float distanceSquared = dx*dx + dy*dy + dz*dz;
            if (distanceSquared > options.cullRadius * options.cullRadius) {
                includeAtom = false;
            }
        }
        
        if (includeAtom) {
            selectedAtoms.push_back(i);
        }
    }
    
    if (options.subsampleRatio < 1.0f && !selectedAtoms.empty()) {
        std::random_device rd;
        std::mt19937 gen(rd());
        std::shuffle(selectedAtoms.begin(), selectedAtoms.end(), gen);
        
        int targetCount = static_cast<int>(selectedAtoms.size() * options.subsampleRatio);
        selectedAtoms.resize(targetCount);
    }
    
    if (options.maxAtoms > 0 && selectedAtoms.size() > static_cast<size_t>(options.maxAtoms)) {
        selectedAtoms.resize(options.maxAtoms);
    }
    
    std::cout << "Exportando " << selectedAtoms.size() << " de " << frame.natoms 
              << " átomos (" << (100.0f * selectedAtoms.size() / frame.natoms) << "%)" << std::endl;

    int segments, rings;
    if (selectedAtoms.size() > 100000) {
        segments = 6; rings = 4;  
    } else if (selectedAtoms.size() > 10000) {
        segments = 8; rings = 6;  
    } else {
        segments = 12; rings = 8; 
    }
    
    std::vector<float> sphereVertices;
    std::vector<uint16_t> sphereIndices;

    float minX = atomRadius, maxX = -atomRadius;
    float minY = atomRadius, maxY = -atomRadius;
    float minZ = atomRadius, maxZ = -atomRadius;

    for (int ring = 0; ring <= rings; ++ring) {
        float phi = M_PI * ring / rings;
        float y = cos(phi) * atomRadius;
        float ringRadius = sin(phi) * atomRadius;
        for (int segment = 0; segment <= segments; ++segment) {
            float theta = 2.0f * M_PI * segment / segments;
            float x = cos(theta) * ringRadius;
            float z = sin(theta) * ringRadius;
            
            minX = std::min(minX, x); maxX = std::max(maxX, x);
            minY = std::min(minY, y); maxY = std::max(maxY, y);
            minZ = std::min(minZ, z); maxZ = std::max(maxZ, z);
            
            sphereVertices.push_back(x); sphereVertices.push_back(y); sphereVertices.push_back(z);
            float norm_len = std::sqrt(x*x + y*y + z*z);
            if (norm_len > 0.0f) {
                sphereVertices.push_back(x / norm_len); sphereVertices.push_back(y / norm_len); sphereVertices.push_back(z / norm_len);
            } else {
                sphereVertices.push_back(0); sphereVertices.push_back(1); sphereVertices.push_back(0);
            }
        }
    }

    for (int ring = 0; ring < rings; ++ring) {
        for (int segment = 0; segment < segments; ++segment) {
            uint16_t current = ring * (segments + 1) + segment;
            uint16_t next = current + segments + 1;
            sphereIndices.push_back(current); sphereIndices.push_back(next); sphereIndices.push_back(current + 1);
            sphereIndices.push_back(current + 1); sphereIndices.push_back(next); sphereIndices.push_back(next + 1);
        }
    }

    size_t vertexBufferOffset = bufferData.size();
    bufferData.insert(bufferData.end(), reinterpret_cast<uint8_t*>(sphereVertices.data()), 
                     reinterpret_cast<uint8_t*>(sphereVertices.data()) + sphereVertices.size() * sizeof(float));
    size_t indexBufferOffset = bufferData.size();
    bufferData.insert(bufferData.end(), reinterpret_cast<uint8_t*>(sphereIndices.data()), 
                     reinterpret_cast<uint8_t*>(sphereIndices.data()) + sphereIndices.size() * sizeof(uint16_t));

    bufferViews.push_back({ {"buffer", 0}, {"byteOffset", vertexBufferOffset}, {"byteLength", sphereVertices.size() * sizeof(float)}, {"byteStride", sizeof(float) * 6}, {"target", 34962} });
    bufferViews.push_back({ {"buffer", 0}, {"byteOffset", indexBufferOffset}, {"byteLength", sphereIndices.size() * sizeof(uint16_t)}, {"target", 34963} });
    
    accessors.push_back({ 
        {"bufferView", 0}, {"byteOffset", 0}, {"componentType", 5126}, 
        {"count", sphereVertices.size() / 6}, {"type", "VEC3"},
        {"min", json::array({minX, minY, minZ})}, {"max", json::array({maxX, maxY, maxZ})}
    });
    accessors.push_back({ 
        {"bufferView", 0}, {"byteOffset", sizeof(float) * 3}, {"componentType", 5126}, 
        {"count", sphereVertices.size() / 6}, {"type", "VEC3"},
        {"min", json::array({-1.0f, -1.0f, -1.0f})}, {"max", json::array({1.0f, 1.0f, 1.0f})}
    });
    accessors.push_back({ 
        {"bufferView", 1}, {"byteOffset", 0}, {"componentType", 5123}, 
        {"count", sphereIndices.size()}, {"type", "SCALAR"} 
    });

    std::map<int, std::vector<int>> atomsByLammpsType;
    for (int atomIdx : selectedAtoms) {
        int lammpsType = (atomIdx < static_cast<int>(frame.types.size())) ? frame.types[atomIdx] : 0;
        atomsByLammpsType[lammpsType].push_back(atomIdx);
    }
    
    int currentMeshIndex = 0;
    
    for (const auto& [lammpsType, atomIndices] : atomsByLammpsType) {
        if (atomIndices.empty()) continue;

        int totalAtoms = atomIndices.size();
        int chunks = std::max(1, (totalAtoms + options.maxInstancesPerMesh - 1) / options.maxInstancesPerMesh);
        int atomsPerChunk = (totalAtoms + chunks - 1) / chunks;
        
        for (int chunk = 0; chunk < chunks; ++chunk) {
            int startIdx = chunk * atomsPerChunk;
            int endIdx = std::min(startIdx + atomsPerChunk, totalAtoms);
            if (startIdx >= endIdx) break;
            
            if (chunk == 0) {
                auto colorIt = lammpsTypeColors.find(lammpsType);
                std::vector<float> color = (colorIt != lammpsTypeColors.end()) ? colorIt->second : lammpsTypeColors[0];
                
                materials.push_back({
                    {"name", "Material_LammpsType_" + std::to_string(lammpsType)},
                    {"pbrMetallicRoughness", {
                        {"baseColorFactor", color},
                        {"metallicFactor", 0.1},
                        {"roughnessFactor", 0.8}
                    }}
                });
            }
            
            json primitive = {
                {"attributes", { {"POSITION", 0}, {"NORMAL", 1} }},
                {"indices", 2},
                {"material", currentMeshIndex},
                {"mode", 4}
            };
            
            std::string meshName = "AtomSphere_Type_" + std::to_string(lammpsType);
            if (chunks > 1) {
                meshName += "_Chunk_" + std::to_string(chunk);
            }
            
            meshes.push_back({
                {"name", meshName},
                {"primitives", json::array({primitive})}
            });

            std::vector<float> translations;
            translations.reserve((endIdx - startIdx) * 3);
            
            float transMinX = std::numeric_limits<float>::max();
            float transMaxX = std::numeric_limits<float>::lowest();
            float transMinY = std::numeric_limits<float>::max();
            float transMaxY = std::numeric_limits<float>::lowest();
            float transMinZ = std::numeric_limits<float>::max();
            float transMaxZ = std::numeric_limits<float>::lowest();
            
            for (int i = startIdx; i < endIdx; ++i) {
                int atomIdx = atomIndices[i];
                const auto& pos = frame.positions[atomIdx];
                float x = pos.x(), y = pos.y(), z = pos.z();
                
                translations.push_back(x);
                translations.push_back(y);
                translations.push_back(z);
                
                transMinX = std::min(transMinX, x); transMaxX = std::max(transMaxX, x);
                transMinY = std::min(transMinY, y); transMaxY = std::max(transMaxY, y);
                transMinZ = std::min(transMinZ, z); transMaxZ = std::max(transMaxZ, z);
            }

            size_t translationBufferOffset = bufferData.size();
            bufferData.insert(bufferData.end(), reinterpret_cast<uint8_t*>(translations.data()), 
                             reinterpret_cast<uint8_t*>(translations.data()) + translations.size() * sizeof(float));

            bufferViews.push_back({ {"buffer", 0}, {"byteOffset", translationBufferOffset}, {"byteLength", translations.size() * sizeof(float)}, {"target", 34962} });
            
            int translationAccessorIndex = accessors.size();
            accessors.push_back({
                {"bufferView", bufferViews.size() - 1},
                {"byteOffset", 0},
                {"componentType", 5126},
                {"count", endIdx - startIdx},
                {"type", "VEC3"},
                {"min", json::array({transMinX, transMinY, transMinZ})},
                {"max", json::array({transMaxX, transMaxY, transMaxZ})}
            });

            std::string nodeName = "Atoms_Instanced_Type_" + std::to_string(lammpsType);
            if (chunks > 1) {
                nodeName += "_Chunk_" + std::to_string(chunk);
            }
            
            nodes.push_back({
                {"name", nodeName},
                {"mesh", meshes.size() - 1},
                {"extensions", {
                    {"EXT_mesh_gpu_instancing", {
                        {"attributes", {
                            {"TRANSLATION", translationAccessorIndex}
                        }}
                    }}
                }}
            });
            
            gltf["scenes"][0]["nodes"].push_back(nodes.size() - 1);
        }
        
        currentMeshIndex++; 
    }
    std::string encodedBuffer = base64_encode(bufferData.data(), bufferData.size());

    gltf["nodes"] = nodes;
    gltf["meshes"] = meshes;
    gltf["materials"] = materials;
    gltf["accessors"] = accessors;
    gltf["bufferViews"] = bufferViews;
    gltf["buffers"] = json::array({
        {
            {"byteLength", bufferData.size()},
            {"uri", "data:application/octet-stream;base64," + encodedBuffer}
        }
    });
    
    gltf["extras"] = {
        {"originalAtomCount", frame.natoms},
        {"exportedAtomCount", selectedAtoms.size()},
        {"sphereResolution", json::array({segments, rings})},
        {"optimizationSettings", {
            {"maxAtoms", options.maxAtoms},
            {"subsampleRatio", options.subsampleRatio},
            {"spatialCulling", options.spatialCulling},
            {"maxInstancesPerMesh", options.maxInstancesPerMesh}
        }}
    };
    
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot create GLTF file: " + filename);
    }
    file << std::setw(2) << gltf << std::endl;
    
    std::cout << "GLTF exportado: " << filename << std::endl;
    std::cout << "Tamaño del buffer: " << bufferData.size() / (1024.0 * 1024.0) << " MB" << std::endl;
}

json DXAJsonExporter::exportAnalysisData(
    const DislocationNetwork* network,
    const InterfaceMesh* interfaceMesh, 
    const LammpsParser::Frame& frame,
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes,
    bool includeDetailedNetworkInfo,
    bool includeTopologyInfo
){
    json data;

    data["dislocations"] = exportDislocationsToJson(network, includeDetailedNetworkInfo, &frame.simulationCell);
    data["interface_mesh"] = getInterfaceMeshData(interfaceMesh, interfaceMesh->structureAnalysis(), includeTopologyInfo);
    data["atoms"] = getAtomsData(frame, tracer, structureTypes);
    //data["cluster_graph"] = exportClusterGraphToJson(&network->clusterGraph());
    data["simulation_cell"] = getExtendedSimulationCellInfo(frame.simulationCell);
    data["structures"] = interfaceMesh->structureAnalysis().getStructureStatisticsJson();
    
    if(includeDetailedNetworkInfo){
        data["network_statistics"] = getNetworkStatistics(network, frame.simulationCell.volume3D());
        data["junction_information"] = getJunctionInformation(network);
        data["circuit_information"] = getCircuitInformation(network);
    }
    
    if(includeTopologyInfo){
        data["topology"] = getTopologyInformation(interfaceMesh);
    }
    
    data["processing_time"] = getProcessingTime();
    
    data["metadata"] = getMetadata();
    data["metadata"]["analysis_timestamp"] = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    data["metadata"]["timestep"] = frame.timestep;
    data["metadata"]["atom_count"] = frame.natoms;
    
    return data;
}

void DXAJsonExporter::exportInterfaceMeshToVTK(
    const InterfaceMesh& interfaceMesh, 
    const StructureAnalysis& structureAnalysis, 
    const std::string &filename
){
    // Lambda to detect facets that cross periodic boundaries
    auto isWrappedFacet = [&structureAnalysis](const InterfaceMesh::Face* face) -> bool{
        auto* edge = face->edges();
        auto* start = edge;
        do{
            Vector3 vec = edge->vertex1()->pos() - edge->vertex2()->pos();
            if(structureAnalysis.cell().isWrappedVector(vec)){
                return true;
            }
            edge = edge->nextFaceEdge();
        }while(edge != start);

        return false;
    };

    // Count facets that DO NOT cross periodic boundaries
    size_t numFacets = 0;
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)) numFacets++;
    }

    std::ofstream stream(filename);
    if(!stream){
        throw std::runtime_error("Cannot create VTK file: " + filename);
    }

    // VTK Header
    stream << "# vtk DataFile Version 3.0\n";
    stream << "# Interface mesh from OpenDXA dislocation analysis\n";
    stream << "ASCII\n";
    stream << "DATASET UNSTRUCTURED_GRID\n";

    // Write vertices
    stream << "POINTS " << interfaceMesh.vertexCount() << " float\n";
    for(const auto* vertex : interfaceMesh.vertices()){
        const Point3& pos = vertex->pos();
        stream << pos.x() << " " << pos.y() << " " << pos.z() << "\n";
    }

    // Write cells (triangles)
    stream << "\nCELLS " << numFacets << " " << (numFacets * 4) << "\n";
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)){
            stream << "3"; 
            auto* e = face->edges();
            auto* start = e;
            do{
                stream << " " << e->vertex1()->index();
                e = e->nextFaceEdge();
            }while(e != start);
            stream << "\n";
        }
    }

    // Cell types (all are triangles = type 5)
    stream << "\nCELL_TYPES " << numFacets << "\n";
    for(size_t i = 0; i < numFacets; i++){
        stream << "5\n"; 
    }

    stream << "\nCELL_DATA " << numFacets << "\n";
    // Scalar 1: Dislocation segment ID
    stream << "SCALARS dislocation_segment int 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)){
            if(face->circuit != nullptr && (!face->circuit->isDangling || face->testFlag(1))){
                DislocationSegment* segment = face->circuit->dislocationNode->segment;
                //Follow the chain of replacements
                while(segment->replacedWith != nullptr){
                    segment = segment->replacedWith;
                }
                stream << segment->id << "\n";
            }else{
                // No dislocation segment
                stream << "-1\n";  
            }
        }
    }

    // Scalar 2: Primary segment flag
    stream << "\nSCALARS is_primary_segment int 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)){
            stream << (face->testFlag(1) ? 1 : 0) << "\n";
        }
    }

    // Scalar 3: Burgers vector (magnitude)
    stream << "\nSCALARS burgers_magnitude float 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)){
            if(face->circuit != nullptr) {
                ClusterVector bv = face->circuit->calculateBurgersVector();
                stream << bv.localVec().length() << "\n";
            } else {
                stream << "0.0\n";
            }
        }
    }

    // Vector 1: Complete Burgers Vector
    stream << "\nVECTORS burgers_vector float\n";
    for(const auto* face : interfaceMesh.faces()){
        if(!isWrappedFacet(face)){
            if(face->circuit != nullptr){
                ClusterVector bv = face->circuit->calculateBurgersVector();
                const Vector3& v = bv.localVec();
                stream << v.x() << " " << v.y() << " " << v.z() << "\n";
            }else{
                stream << "0.0 0.0 0.0\n";
            }
        }
    }

    stream.close();
    spdlog::info("Interface mesh exported to VTK: {}", filename);
}


void DXAJsonExporter::exportAtomsToVTK(
    const LammpsParser::Frame& frame,
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes,
    const std::string& filename
) {
    std::ofstream stream(filename);
    if(!stream) {
        throw std::runtime_error("Cannot create VTK file: " + filename);
    }

    // VTK Header
    stream << "# vtk DataFile Version 3.0\n";
    stream << "# Atomic structure from OpenDXA analysis\n";
    stream << "ASCII\n";
    stream << "DATASET UNSTRUCTURED_GRID\n";

    // Count valid atoms
    int validAtoms = 0;
    for(int i = 0; i < frame.natoms; ++i) {
        if(i < static_cast<int>(frame.positions.size())) {
            validAtoms++;
        }
    }

    // Write points (atom positions)
    stream << "POINTS " << validAtoms << " float\n";
    for(int i = 0; i < frame.natoms; ++i) {
        if(i < static_cast<int>(frame.positions.size())) {
            const auto& pos = frame.positions[i];
            stream << pos.x() << " " << pos.y() << " " << pos.z() << "\n";
        }
    }

    // Write cells (each atom is a vertex cell)
    stream << "\nCELLS " << validAtoms << " " << (validAtoms * 2) << "\n";
    for(int i = 0; i < validAtoms; ++i) {
        stream << "1 " << i << "\n";  // Each atom is a vertex
    }

    // Cell types (all are vertices = type 1)
    stream << "\nCELL_TYPES " << validAtoms << "\n";
    for(int i = 0; i < validAtoms; ++i) {
        stream << "1\n";  // VTK_VERTEX
    }

    // Point data
    stream << "\nPOINT_DATA " << validAtoms << "\n";

    // Scalar 1: Structure type (for coloring)
    stream << "SCALARS structure_type int 1\n";
    stream << "LOOKUP_TABLE structure_type_table\n";
    for(int i = 0; i < frame.natoms; ++i) {
        if(i < static_cast<int>(frame.positions.size())) {
            int structureType = 0;  // Default to OTHER
            if(structureTypes && i < static_cast<int>(structureTypes->size())) {
                structureType = (*structureTypes)[i];
            }
            stream << structureType << "\n";
        }
    }

    // Scalar 2: LAMMPS atom type
    stream << "\nSCALARS lammps_type int 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(int i = 0; i < frame.natoms; ++i) {
        if(i < static_cast<int>(frame.positions.size())) {
            int lammpsType = (i < static_cast<int>(frame.types.size())) ? frame.types[i] : 0;
            stream << lammpsType << "\n";
        }
    }

    // Scalar 3: Core atoms (if available)
    if(tracer && !tracer->_coreAtomIndices.empty()) {
        stream << "\nSCALARS is_core_atom int 1\n";
        stream << "LOOKUP_TABLE default\n";
        for(int i = 0; i < frame.natoms; ++i) {
            if(i < static_cast<int>(frame.positions.size())) {
                bool isCoreAtom = tracer->_coreAtomIndices.count(i) > 0;
                stream << (isCoreAtom ? 1 : 0) << "\n";
            }
        }
    }

    // Scalar 4: Atom IDs (for debugging)
    stream << "\nSCALARS atom_id int 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(int i = 0; i < frame.natoms; ++i) {
        if(i < static_cast<int>(frame.positions.size())) {
            int atomId = (i < static_cast<int>(frame.ids.size())) ? frame.ids[i] : i;
            stream << atomId << "\n";
        }
    }

    // Define color lookup table for structure types
    stream << "\nLOOKUP_TABLE structure_type_table 32\n";
    
    // Colors for different structure types (RGB + Alpha)
    // 0: OTHER - Gray
    stream << "0.5 0.5 0.5 1.0\n";
    // 1: FCC - Blue
    stream << "0.0 0.0 1.0 1.0\n";
    // 2: BCC - Red  
    stream << "1.0 0.0 0.0 1.0\n";
    // 3: HCP - Green
    stream << "0.0 1.0 0.0 1.0\n";
    // 4: ICO - Yellow
    stream << "1.0 1.0 0.0 1.0\n";
    // 5: SC - Magenta
    stream << "1.0 0.0 1.0 1.0\n";
    // 6: CUBIC_DIAMOND - Cyan
    stream << "0.0 1.0 1.0 1.0\n";
    // 7: HEX_DIAMOND - Orange
    stream << "1.0 0.5 0.0 1.0\n";
    // 8: GRAPHENE - Pink
    stream << "1.0 0.0 0.5 1.0\n";
    
    // Fill remaining entries with default colors
    for(int i = 9; i < 32; ++i) {
        float r = static_cast<float>(i % 3) / 2.0f;
        float g = static_cast<float>((i / 3) % 3) / 2.0f;
        float b = static_cast<float>((i / 9) % 3) / 2.0f;
        stream << r << " " << g << " " << b << " 1.0\n";
    }

    stream.close();
    spdlog::info("Atoms exported to VTK: {}", filename);
}

void DXAJsonExporter::exportDislocationsToVTK(
    const DislocationNetwork* network,
    const SimulationCell& cell,
    const std::string& filename
) {
    const auto& segments = network->segments();
    
    std::ofstream stream(filename);
    if(!stream) {
        throw std::runtime_error("Cannot create VTK file: " + filename);
    }

    // Count valid points and lines
    int totalPoints = 0;
    int validSegments = 0;
    
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            totalPoints += segment->line.size();
            validSegments++;
        }
    }

    if(totalPoints == 0 || validSegments == 0) {
        spdlog::warn("No valid dislocation segments to export");
        return;
    }

    // VTK Header
    stream << "# vtk DataFile Version 3.0\n";
    stream << "# Dislocation network from OpenDXA\n";
    stream << "ASCII\n";
    stream << "DATASET UNSTRUCTURED_GRID\n";

    // Write points
    stream << "POINTS " << totalPoints << " float\n";
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            for(const auto& point : segment->line) {
                stream << point.x() << " " << point.y() << " " << point.z() << "\n";
            }
        }
    }

    // Write lines
    int totalLineData = 0;
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            totalLineData += segment->line.size() + 1; // +1 for count
        }
    }

    stream << "\nCELLS " << validSegments << " " << totalLineData << "\n";
    
    int pointOffset = 0;
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            stream << segment->line.size();
            for(size_t i = 0; i < segment->line.size(); ++i) {
                stream << " " << (pointOffset + i);
            }
            stream << "\n";
            pointOffset += segment->line.size();
        }
    }

    // Cell types (all are poly-lines = type 4)
    stream << "\nCELL_TYPES " << validSegments << "\n";
    for(int i = 0; i < validSegments; ++i) {
        stream << "4\n";  // VTK_POLY_LINE
    }

    // Cell data
    stream << "\nCELL_DATA " << validSegments << "\n";

    // Burgers vector magnitude
    stream << "SCALARS burgers_magnitude float 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            Vector3 burgers = segment->burgersVector.localVec();
            stream << burgers.length() << "\n";
        }
    }

    // Segment length
    stream << "\nSCALARS segment_length float 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            stream << segment->calculateLength() << "\n";
        }
    }

    // Segment ID
    stream << "\nSCALARS segment_id int 1\n";
    stream << "LOOKUP_TABLE default\n";
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            stream << segment->id << "\n";
        }
    }

    // Burgers vector (3D)
    stream << "\nVECTORS burgers_vector float\n";
    for(const auto* segment : segments) {
        if(segment && !segment->isDegenerate() && segment->line.size() >= 2) {
            Vector3 burgers = segment->burgersVector.localVec();
            stream << burgers.x() << " " << burgers.y() << " " << burgers.z() << "\n";
        }
    }

    stream.close();
    spdlog::info("Dislocations exported to VTK: {}", filename);
}

json DXAJsonExporter::exportDislocationsToJson(
    const DislocationNetwork* network, 
    bool includeDetailedInfo, 
    const SimulationCell* simulationCell
){
      json dislocations;
    const auto& segments = network->segments();
    
    dislocations["metadata"] = {
        {"type", "dislocation_segments"},
        {"count", static_cast<int>(segments.size())}
    };
    
    json dataArray = json::array();
    double totalLength = 0.0;
    int totalPoints = 0;
    double maxLength = 0.0;
    double minLength = std::numeric_limits<double>::max();
    int pointOffset = 0;
    
    for(size_t i = 0; i < segments.size(); ++i){
        auto* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            json segmentJson;
            
            double length = segment->calculateLength();
            segmentJson["index"] = static_cast<int>(i);
            segmentJson["type"] = getDislocationType(segment);
            segmentJson["point_index_offset"] = pointOffset;
            segmentJson["num_points"] = static_cast<int>(segment->line.size());
            segmentJson["length"] = length;
            
            json points = json::array();
            
            // Ensure segment continuity across periodic boundaries
            // TODO: NO!
            if(simulationCell && !segment->line.empty()){
                // Start with the first point
                Point3 prevWrappedPoint = simulationCell->wrapPoint(segment->line[0]);
                points.push_back({prevWrappedPoint.x(), prevWrappedPoint.y(), prevWrappedPoint.z()});
                
                // For subsequent points, ensure continuity by choosing the periodic image closest to the previous point
                for(size_t ptIdx = 1; ptIdx < segment->line.size(); ++ptIdx){
                    const Point3& currentPoint = segment->line[ptIdx];
                    Point3 bestPoint = currentPoint;
                    double minDistance = (currentPoint - prevWrappedPoint).length();
                    
                    // Check all periodic images to find the one closest to the previous point
                    for(int dx = -1; dx <= 1; ++dx){
                        for(int dy = -1; dy <= 1; ++dy){
                            for(int dz = -1; dz <= 1; ++dz){
                                if(!simulationCell->pbcFlags()[0] && dx != 0) continue;
                                if(!simulationCell->pbcFlags()[1] && dy != 0) continue; 
                                if(!simulationCell->pbcFlags()[2] && dz != 0) continue;
                                
                                Vector3 translation = dx * simulationCell->matrix().column(0) +
                                                    dy * simulationCell->matrix().column(1) +
                                                    dz * simulationCell->matrix().column(2);
                                Point3 candidatePoint = currentPoint + translation;
                                double distance = (candidatePoint - prevWrappedPoint).length();
                                
                                if(distance < minDistance){
                                    minDistance = distance;
                                    bestPoint = candidatePoint;
                                }
                            }
                        }
                    }
                    
                    points.push_back({bestPoint.x(), bestPoint.y(), bestPoint.z()});
                    prevWrappedPoint = bestPoint;
                }
            } else {
                // Fallback: just export points as-is
                for(const auto& point : segment->line){
                    points.push_back({point.x(), point.y(), point.z()});
                }
            }

            segmentJson["points"] = points;
            
            Vector3 burgers = segment->burgersVector.localVec();
            segmentJson["burgers"] = {
                {"vector", {burgers.x(), burgers.y(), burgers.z()}},
                {"magnitude", burgers.length()},
                {"fractional", getBurgersVectorString(burgers)}
            };
            
            if(includeDetailedInfo){
                segmentJson["junction_info"] = {
                    {"forward_node_dangling", segment->forwardNode().isDangling()},
                    {"backward_node_dangling", segment->backwardNode().isDangling()},
                    {"junction_arms_count", segment->forwardNode().countJunctionArms()},
                    {"forms_junction", !segment->forwardNode().isDangling()}
                };
                
                if(!segment->coreSize.empty()){
                    json coreSizes = json::array();
                    for(int coreSize : segment->coreSize){
                        coreSizes.push_back(coreSize);
                    }
                    segmentJson["core_sizes"] = coreSizes;
                    segmentJson["average_core_size"] = 
                        std::accumulate(segment->coreSize.begin(), segment->coreSize.end(), 0.0) / segment->coreSize.size();
                }
                
                segmentJson["is_closed_loop"] = segment->isClosedLoop();
                segmentJson["is_infinite_line"] = segment->isInfiniteLine();
                segmentJson["segment_id"] = segment->id;
                
                if(segment->line.size() >= 2){
                    Vector3 lineDir = (segment->line.back() - segment->line.front()).normalized();
                    segmentJson["line_direction"] = {
                        {"vector", {lineDir.x(), lineDir.y(), lineDir.z()}},
                        {"string", getLineDirectionString(lineDir)}
                    };
                }
                
                segmentJson["nodes"] = {
                    {"forward", nodeToJson(&segment->forwardNode())},
                    {"backward", nodeToJson(&segment->backwardNode())}
                };
            }
            
            dataArray.push_back(segmentJson);
            totalLength += length;
            totalPoints += segment->line.size();
            maxLength = std::max(maxLength, length);
            minLength = std::min(minLength, length);
            pointOffset += segment->line.size();
        }
    }
    
    dislocations["data"] = dataArray;
    
    if(segments.empty()){
        minLength = 0.0;
    }
    
    dislocations["summary"] = {
        {"total_points", totalPoints},
        {"average_segment_length", segments.empty() ? 0.0 : totalLength / segments.size()},
        {"max_segment_length", maxLength},
        {"min_segment_length", minLength},
        {"total_length", totalLength}
    };
    
    return dislocations;
}

json DXAJsonExporter::getInterfaceMeshData(
    const InterfaceMesh* interfaceMesh,
    const StructureAnalysis& structureAnalysis,
    bool includeTopologyInfo
){
    json meshData;
    const auto& originalVertices = interfaceMesh->vertices();
    const auto& originalFaces = interfaceMesh->faces();
    const auto& cell = structureAnalysis.cell();

    std::vector<Point3> exportPoints;
    exportPoints.reserve(originalVertices.size());

    std::vector<int> originalToExportVertexMap(originalVertices.size());

    for(size_t i = 0; i < originalVertices.size(); ++i){
        exportPoints.push_back(originalVertices[i]->pos());
        originalToExportVertexMap[i] = i;
    }

    std::vector<std::vector<int>> exportFaces;
    exportFaces.reserve(originalFaces.size());

    for(const auto* face : originalFaces){
        if (!face || !face->edges()) continue;

        std::vector<int> faceVertexIndices;
        std::vector<Point3> faceVertexPositions;

        auto* startEdge = face->edges();
        auto* currentEdge = startEdge;
        do{
            faceVertexIndices.push_back(currentEdge->vertex1()->index());
            faceVertexPositions.push_back(currentEdge->vertex1()->pos());
            currentEdge = currentEdge->nextFaceEdge();
        }while(currentEdge != startEdge);

        cell.unwrapPositions(faceVertexPositions.data(), faceVertexPositions.size());

        std::vector<int> newFaceIndices;
        for(size_t i = 0; i < faceVertexIndices.size(); ++i){
            int originalIndex = faceVertexIndices[i];
            const Point3& originalPos = originalVertices[originalIndex]->pos();
            const Point3& unwrappedPos = faceVertexPositions[i];

            if(!originalPos.equals(unwrappedPos, 1e-6)){
                newFaceIndices.push_back(exportPoints.size());
                exportPoints.push_back(unwrappedPos);
            }else{
                newFaceIndices.push_back(originalToExportVertexMap[originalIndex]);
            }
        }
        exportFaces.push_back(newFaceIndices);
    }
    
    meshData["metadata"] = {
        {"type", "interface_mesh"},
        {"count", static_cast<int>(originalFaces.size())},
        {"components", {
            {"num_nodes", static_cast<int>(exportPoints.size())},
            {"num_facets", static_cast<int>(exportFaces.size())}
        }}
    };

    json points = json::array();
    for(size_t i = 0; i < exportPoints.size(); ++i){
        const auto& pos = exportPoints[i];
        points.push_back({
            {"index", static_cast<int>(i)},
            {"position", {pos.x(), pos.y(), pos.z()}}
        });
    }

    json facets = json::array();
    for(const auto& faceIndices : exportFaces){
        assert(faceIndices.size() == 3 && "The interface mesh does not contain any triangular faces.");
        facets.push_back({
            {"vertices", faceIndices}
        });
    }

    meshData["data"] = {
        {"points", points},
        {"facets", facets}
    };
    
    if(includeTopologyInfo){
        std::set<std::pair<int, int>> originalEdgeSet;
        for(const auto* face : originalFaces){
            if(!face || !face->edges()) continue;
            auto* edge = face->edges();
            do{
                int v1 = edge->vertex1()->index();
                int v2 = edge->vertex2()->index();
                if (v1 > v2) std::swap(v1, v2);  
                originalEdgeSet.insert({v1, v2});
                edge = edge->nextFaceEdge();
            }while(edge != face->edges());
        }

        meshData["topology"] = {
            {"euler_characteristic", static_cast<int>(originalVertices.size()) - static_cast<int>(originalEdgeSet.size()) + static_cast<int>(originalFaces.size())},
            {"is_completely_good", interfaceMesh->isCompletelyGood()},
            {"is_completely_bad", interfaceMesh->isCompletelyBad()}
        };
    }
    
    return meshData;
}

json DXAJsonExporter::getAtomsData(
    const LammpsParser::Frame& frame, 
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes
){
    json atomsData;

    atomsData["metadata"] = {
        {"type", "atomic_structure"},
        {"count", frame.natoms}
    };
    
    json dataArray = json::array();
    std::map<int, int> cnaTypeDistribution;
    
    int totalCoordination = 0;
    int validAtoms = 0;
    
    for(int i = 0; i < frame.natoms; ++i){
        json atomJson;
        
        atomJson["node_id"] = i;
        
        if(i < static_cast<int>(frame.positions.size())){
            const auto& pos = frame.positions[i];
            atomJson["position"] = {pos.x(), pos.y(), pos.z()};
        }else{
            atomJson["position"] = {0.0, 0.0, 0.0};
        }
        
        int structureType = 0;
        if(structureTypes && i < static_cast<int>(structureTypes->size())){
            structureType = (*structureTypes)[i];
        }
        
        int lammpsType = (i < static_cast<int>(frame.types.size())) ? frame.types[i] : 0;

        // TODO: ???????????
        atomJson["lammps_type"] = lammpsType;
        atomJson["atom_type"] = structureType;
        atomJson["type_name"] = tracer->mesh().structureAnalysis().getStructureTypeName(structureType);
        
        cnaTypeDistribution[structureType]++;
        validAtoms++;
        
        dataArray.push_back(atomJson);
    }
    
    atomsData["data"] = dataArray;
    
    int mostCommonCnaType = 0;
    int maxCount = 0;
    for(const auto& [type, count] : cnaTypeDistribution){
        if(count > maxCount){
            maxCount = count;
            mostCommonCnaType = type;
        }
    }
    
    atomsData["summary"] = {
        {"cna_type_distribution", cnaTypeDistribution},
        {"most_common_cna_type", mostCommonCnaType},
        {"unique_cna_types", static_cast<int>(cnaTypeDistribution.size())}
    };
        
    std::unordered_set<int> coreAtomIds;
    for(auto &atomJson : atomsData["data"]){
        int idx = atomJson["node_id"];
        atomJson["is_core"] = tracer->_coreAtomIndices.count(idx) ? true : false;
    }

    return atomsData;
}

json DXAJsonExporter::exportClusterGraphToJson(const ClusterGraph* graph){
    json clusterGraphJson;

    clusterGraphJson["metadata"] = {
        {"type", "cluster_graph"},
        {"cluster_count", static_cast<int>(graph->clusters().size())},
        {"transition_count", static_cast<int>(graph->clusterTransitions().size())}
    };

    json clustersJson = json::array();
    for (const Cluster* cluster : graph->clusters()) {
        if (!cluster) continue;

        json clusterJson;
        clusterJson["id"] = cluster->id;
        clusterJson["structure"] = cluster->structure;
        clusterJson["atom_count"] = cluster->atomCount;
        clusterJson["orientation"] = matrixToJson(cluster->orientation);

        if (cluster->parentTransition) {
            clusterJson["parent_cluster"] = cluster->parentTransition->cluster2->id;
        }

        clustersJson.push_back(clusterJson);
    }

    json transitionsJson = json::array();
    for (const ClusterTransition* t : graph->clusterTransitions()) {
        if (!t) continue;

        json transitionJson;
        transitionJson["cluster1"] = t->cluster1->id;
        transitionJson["cluster2"] = t->cluster2->id;
        transitionJson["area"] = t->area;
        transitionJson["distance"] = t->distance;
        transitionJson["transformation"] = matrixToJson(t->tm);

        transitionsJson.push_back(transitionJson);
    }

    clusterGraphJson["clusters"] = clustersJson;
    clusterGraphJson["transitions"] = transitionsJson;

    return clusterGraphJson;
}

json DXAJsonExporter::getProcessingTime(){
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - _startTime);
    
    json timeData;
    timeData["duration_ms"] = duration.count();
    timeData["duration_seconds"] = duration.count() / 1000.0;
    timeData["start_time"] = std::chrono::duration_cast<std::chrono::seconds>(_startTime.time_since_epoch()).count();
    timeData["end_time"] = std::chrono::duration_cast<std::chrono::seconds>(endTime.time_since_epoch()).count();
    
    return timeData;
}

json DXAJsonExporter::getMetadata(){
    json metadata;
    metadata["export_timestamp"] = std::chrono::duration_cast<std::chrono::seconds>(std::chrono::system_clock::now().time_since_epoch()).count();
    
    if(!_filename.empty()){
        std::filesystem::path filepath(_filename);
        metadata["source_file"] = filepath.filename().string();
        metadata["source_path"] = filepath.string();
    }
    
    return metadata;
}

bool DXAJsonExporter::saveToFile(const json& data, const std::string& filepath){
    try{
        std::ofstream file(filepath);
        if(!file.is_open()){
            return false;
        }
        
        file << std::setw(2) << data << std::endl;
        return true;
    }catch(const std::exception&){
        return false;
    }
}

json DXAJsonExporter::pointToJson(const Point3& point){
    json pointJson;
    pointJson["x"] = point.x();
    pointJson["y"] = point.y();
    pointJson["z"] = point.z();
    return pointJson;
}

json DXAJsonExporter::vectorToJson(const Vector3& vector){
    json vectorJson;
    vectorJson["x"] = vector.x();
    vectorJson["y"] = vector.y();
    vectorJson["z"] = vector.z();
    return vectorJson;
}

json DXAJsonExporter::matrixToJson(const Matrix3& matrix){
    json matrixJson = json::array();
    for (int i = 0; i < 3; ++i) {
        json row = json::array();
        for (int j = 0; j < 3; ++j) {
            row.push_back(matrix(i, j));
        }
        matrixJson.push_back(row);
    }
    return matrixJson;
}

json DXAJsonExporter::affineTransformationToJson(const AffineTransformation& transform){
    json transformJson = json::array();
    for(int i = 0; i < 3; ++i){
        json row = json::array();
        for(int j = 0; j < 3; ++j){
            row.push_back(transform(i, j));
        }
        transformJson.push_back(row);
    }
    return transformJson;
}

json DXAJsonExporter::simulationCellToJson(const SimulationCell& cell){
    json cellJson;
    
    cellJson["matrix"] = affineTransformationToJson(cell.matrix());
    cellJson["volume"] = cell.volume3D();
    cellJson["is_2d"] = cell.is2D();

    Vector3 a = cell.matrix().column(0);
    Vector3 b = cell.matrix().column(1);
    Vector3 c = cell.matrix().column(2);
    
    cellJson["lattice_vectors"] = {
        {"a", vectorToJson(a)},
        {"b", vectorToJson(b)},
        {"c", vectorToJson(c)}
    };
    
    cellJson["lattice_parameters"] = {
        {"a_length", a.length()},
        {"b_length", b.length()},
        {"c_length", c.length()}
    };
    
    return cellJson;
}

json DXAJsonExporter::getExtendedSimulationCellInfo(const SimulationCell& cell){
    json cellJson = simulationCellToJson(cell);
    
    const auto& pbcFlags = cell.pbcFlags();
    cellJson["periodic_boundary_conditions"] = {
        {"x", pbcFlags[0]},
        {"y", pbcFlags[1]}, 
        {"z", pbcFlags[2]}
    };
    
    Vector3 a = cell.matrix().column(0);
    Vector3 b = cell.matrix().column(1);
    Vector3 c = cell.matrix().column(2);
    
    cellJson["angles"] = {
        {"alpha", calculateAngle(b, c)},
        {"beta", calculateAngle(a, c)},
        {"gamma", calculateAngle(a, b)}
    };
    
    cellJson["reciprocal_lattice"] = {
        {"matrix", affineTransformationToJson(cell.inverseMatrix())},
        {"volume", 1.0 / cell.volume3D()}
    };
    
    cellJson["dimensionality"] = {
        {"is_2d", cell.is2D()},
        {"effective_dimensions", cell.is2D() ? 2 : 3}
    };
    
    return cellJson;
}

json DXAJsonExporter::segmentToJson(const DislocationSegment* segment, bool includeDetailedInfo){
    json segmentJson;
    
    if(!segment || segment->isDegenerate()){
        return segmentJson;
    }
    
    segmentJson["length"] = segment->calculateLength();
    
    Vector3 burgers = segment->burgersVector.localVec();
    segmentJson["burgers_vector"] = vectorToJson(burgers);
    segmentJson["burgers_magnitude"] = burgers.length();
    segmentJson["burgers_string"] = getBurgersVectorString(burgers);

    if(segment->line.size() >= 2){
        Vector3 lineDir = (segment->line.back() - segment->line.front()).normalized();
        segmentJson["line_direction"] = vectorToJson(lineDir);
        segmentJson["line_direction_string"] = getLineDirectionString(lineDir);
    }
    
    json points = json::array();
    for(const auto& point : segment->line){
        points.push_back(pointToJson(point));
    }

    segmentJson["points"] = points;
    segmentJson["point_count"] = points.size();
    
    segmentJson["id"] = segment->id;
    segmentJson["is_closed_loop"] = segment->isClosedLoop();
    segmentJson["is_infinite_line"] = segment->isInfiniteLine();
    segmentJson["is_degenerate"] = segment->isDegenerate();
    
    if(includeDetailedInfo){
        if(!segment->coreSize.empty()){
            json coreSizes = json::array();
            for(int coreSize : segment->coreSize){
                coreSizes.push_back(coreSize);
            }
            segmentJson["core_sizes"] = coreSizes;
            segmentJson["average_core_size"] = 
                std::accumulate(segment->coreSize.begin(), segment->coreSize.end(), 0.0) / segment->coreSize.size();
        }
        
        segmentJson["nodes"] = {
            {"forward", nodeToJson(&segment->forwardNode())},
            {"backward", nodeToJson(&segment->backwardNode())}
        };
        
        if(segment->forwardNode().circuit){
            segmentJson["forward_circuit"] = circuitToJson(segment->forwardNode().circuit);
        }
        if(segment->backwardNode().circuit){
            segmentJson["backward_circuit"] = circuitToJson(segment->backwardNode().circuit);
        }
    }
    
    return segmentJson;
}

std::string DXAJsonExporter::getBurgersVectorString(const Vector3& burgers){
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(3);
    oss << "[" << burgers.x() << " " << burgers.y() << " " << burgers.z() << "]";
    return oss.str();
}

std::string DXAJsonExporter::getLineDirectionString(const Vector3& direction){
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(3);
    oss << "⟨" << direction.x() << " " << direction.y() << " " << direction.z() << "⟩";
    return oss.str();
}

json DXAJsonExporter::getNetworkStatistics(const DislocationNetwork* network, double cellVolume){
    json stats;
    const auto& segments = network->segments();
    
    double totalLength = 0.0;
    int validSegments = 0;
    
    // Paralelizar el cálculo de estadísticas
    #pragma omp parallel for reduction(+:totalLength,validSegments) schedule(dynamic)
    for(size_t i = 0; i < segments.size(); ++i){
        const auto* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            totalLength += segment->calculateLength();
            validSegments++;
        }
    }
    
    stats = {
        {"total_network_length", totalLength},
        {"segment_count", validSegments},
        {"junction_count", countJunctions(network)},
        {"dangling_segments", countDanglingSegments(network)},
        {"average_segment_length", validSegments > 0 ? totalLength / validSegments : 0.0},
        {"density", cellVolume > 0 ? totalLength / cellVolume : 0.0},
        {"total_segments_including_degenerate", static_cast<int>(segments.size())}
    };
    
    return stats;
}

json DXAJsonExporter::getJunctionInformation(const DislocationNetwork* network){
    json junctionInfo;
    const auto& segments = network->segments();
    
    std::map<int, int> junctionArmDistribution;
    int totalJunctions = 0;
    
    for(const auto* segment : segments){
        if(segment){
            int forwardArms = segment->forwardNode().countJunctionArms();
            int backwardArms = segment->backwardNode().countJunctionArms();
            
            if(forwardArms > 1){
                junctionArmDistribution[forwardArms]++;
                totalJunctions++;
            }
            if(backwardArms > 1){
                junctionArmDistribution[backwardArms]++;
                totalJunctions++;
            }
        }
    }
    
    junctionInfo = {
        {"total_junctions", totalJunctions},
        {"junction_arm_distribution", junctionArmDistribution}
    };
    
    return junctionInfo;
}

json DXAJsonExporter::getCircuitInformation(const DislocationNetwork* network){
    json circuitInfo;
    const auto& segments = network->segments();
    
    std::vector<int> edgeCounts;
    int totalCircuits = 0;
    int danglingCircuits = 0;
    int blockedCircuits = 0;
    
    for(const auto* segment : segments){
        if(segment){
            if(segment->forwardNode().circuit){
                auto* circuit = segment->forwardNode().circuit;
                edgeCounts.push_back(circuit->edgeCount);
                totalCircuits++;
                if(circuit->isDangling) danglingCircuits++;
                if(circuit->isCompletelyBlocked) blockedCircuits++;
            }
            
            if(segment->backwardNode().circuit){
                auto* circuit = segment->backwardNode().circuit;
                edgeCounts.push_back(circuit->edgeCount);
                totalCircuits++;
                if(circuit->isDangling) danglingCircuits++;
                if(circuit->isCompletelyBlocked) blockedCircuits++;
            }
        }
    }
    
    double averageEdgeCount = 0.0;
    if(!edgeCounts.empty()){
        averageEdgeCount = std::accumulate(edgeCounts.begin(), edgeCounts.end(), 0.0) / edgeCounts.size();
    }
    
    circuitInfo = {
        {"total_circuits", totalCircuits},
        {"dangling_circuits", danglingCircuits},
        {"blocked_circuits", blockedCircuits},
        {"average_edge_count", averageEdgeCount},
        {"edge_count_range", {
            {"min", edgeCounts.empty() ? 0 : *std::min_element(edgeCounts.begin(), edgeCounts.end())},
            {"max", edgeCounts.empty() ? 0 : *std::max_element(edgeCounts.begin(), edgeCounts.end())}
        }}
    };
    
    return circuitInfo;
}

json DXAJsonExporter::getTopologyInformation(const InterfaceMesh* interfaceMesh){
    json topology;
    const auto& vertices = interfaceMesh->vertices();
    const auto& faces = interfaceMesh->faces();

    std::set<std::pair<int, int>> edgeSet;
    for(const auto* face : faces){
        if(face && face->edges()){
            auto* edge = face->edges();
            do{
                if(edge->vertex1() && edge->vertex2()){
                    int v1 = edge->vertex1()->index();
                    int v2 = edge->vertex2()->index();
                    if (v1 > v2) std::swap(v1, v2);  
                    edgeSet.insert({v1, v2});
                }
                edge = edge->nextFaceEdge();
            }while(edge && edge != face->edges());
        }
    }
    
    topology = {
        {"euler_characteristic", static_cast<int>(vertices.size()) - static_cast<int>(edgeSet.size()) + static_cast<int>(faces.size())},
        {"average_vertex_degree", calculateAverageVertexDegree(interfaceMesh)},
        {"genus", (2 - (static_cast<int>(vertices.size()) - static_cast<int>(edgeSet.size()) + static_cast<int>(faces.size()))) / 2},
        {"mesh_quality", {
            {"is_completely_good", interfaceMesh->isCompletelyGood()},
            {"is_completely_bad", interfaceMesh->isCompletelyBad()}
        }}
    };
    
    return topology;
}

json DXAJsonExporter::nodeToJson(const DislocationNode* node){
    json nodeJson;
    
    if(!node) return nodeJson;
    
    nodeJson = {
        {"is_dangling", node->isDangling()},
        {"is_forward_node", node->isForwardNode()},
        {"is_backward_node", node->isBackwardNode()},
        {"junction_arms_count", node->countJunctionArms()},
        {"position", pointToJson(node->position())},
        {"burgers_vector", vectorToJson(node->burgersVector().localVec())}
    };
    
    return nodeJson;
}

json DXAJsonExporter::circuitToJson(const BurgersCircuit* circuit){
    json circuitJson;
    
    if(!circuit) return circuitJson;
    
    circuitJson = {
        {"edge_count", circuit->edgeCount},
        {"is_dangling", circuit->isDangling},
        {"is_completely_blocked", circuit->isCompletelyBlocked},
        {"center_position", pointToJson(circuit->calculateCenter())},
        {"burgers_vector", vectorToJson(circuit->calculateBurgersVector().localVec())}
    };
    
    return circuitJson;
}

int DXAJsonExporter::countJunctions(const DislocationNetwork* network){
    int junctions = 0;
    const auto& segments = network->segments();
    
    for(const auto* segment : segments){
        if(segment){
            if(!segment->forwardNode().isDangling()) junctions++;
            if(!segment->backwardNode().isDangling()) junctions++;
        }
    }
    
    return junctions / 2;
}

int DXAJsonExporter::countDanglingSegments(const DislocationNetwork* network){
    int dangling = 0;
    const auto& segments = network->segments();
    
    for(const auto* segment : segments){
        if(segment && (segment->forwardNode().isDangling() || segment->backwardNode().isDangling())){
            dangling++;
        }
    }
    
    return dangling;
}

double DXAJsonExporter::calculateAverageVertexDegree(const InterfaceMesh* interfaceMesh){
    const auto& vertices = interfaceMesh->vertices();
    const auto& faces = interfaceMesh->faces();
    
    std::map<int, int> vertexDegree;
    
    for(size_t i = 0; i < vertices.size(); ++i){
        vertexDegree[i] = 0;
    }
    
    for(const auto* face : faces){
        if(face && face->edges()){
            auto* edge = face->edges();
            do{
                if(edge->vertex1() && edge->vertex2()){
                    vertexDegree[edge->vertex1()->index()]++;
                    vertexDegree[edge->vertex2()->index()]++;
                }
                edge = edge->nextFaceEdge();
            }while(edge && edge != face->edges());
        }
    }
    
    double totalDegree = 0.0;
    for(const auto& pair : vertexDegree){
        totalDegree += pair.second;
    }
    
    return vertices.empty() ? 0.0 : totalDegree / vertices.size();
}

double DXAJsonExporter::calculateAngle(const Vector3& a, const Vector3& b){
    double dot = a.dot(b);
    double magnitudes = a.length() * b.length();
    
    if(magnitudes == 0.0) return 0.0;
    
    double cosAngle = dot / magnitudes;
    cosAngle = std::max(-1.0, std::min(1.0, cosAngle));
    
    return std::acos(cosAngle) * 180.0 / PI;
}

json dislocationNetworkToJson(const DislocationNetwork* network){
    DXAJsonExporter exporter;
    return exporter.exportDislocationsToJson(network);
}

json frameToJson(const LammpsParser::Frame& frame, const BurgersLoopBuilder* tracer){
    DXAJsonExporter exporter;
    return exporter.getAtomsData(frame, tracer);
}

}
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
    data["interface_mesh"] = getInterfaceMeshData(interfaceMesh, includeTopologyInfo);
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

json DXAJsonExporter::exportDislocationsToJson(const DislocationNetwork* network, bool includeDetailedInfo, const SimulationCell* simulationCell){
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

json DXAJsonExporter::getInterfaceMeshData(const InterfaceMesh* interfaceMesh, bool includeTopologyInfo) {
    json meshData;
    const auto& meshVertices = interfaceMesh->vertices();
    const auto& meshFaces = interfaceMesh->faces();
    
    std::set<std::pair<int, int>> edgeSet;
    for(const auto* face : meshFaces){
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
    
    meshData["metadata"] = {
        {"type", "interface_mesh"},
        {"count", static_cast<int>(meshFaces.size())},
        {"components", {
            {"num_nodes", static_cast<int>(meshVertices.size())},
            {"num_facets", static_cast<int>(meshFaces.size())},
            {"num_edges", static_cast<int>(edgeSet.size())}
        }}
    };
    
    json points = json::array();
    for(size_t i = 0; i < meshVertices.size(); ++i){
        const auto* vertex = meshVertices[i];
        if(vertex){
            json pointJson;
            pointJson["index"] = static_cast<int>(i);
            pointJson["position"] = json::array({vertex->pos().x(), vertex->pos().y(), vertex->pos().z()});
            points.push_back(pointJson);
        }
    }
    
    json edges = json::array();
    for(const auto& edgePair : edgeSet){
        json edgeJson;
        edgeJson["vertices"] = json::array({edgePair.first, edgePair.second});
        edgeJson["edge_count"] = 1;
        edges.push_back(edgeJson);
    }
    
    json facets = json::array();
    for(size_t i = 0; i < meshFaces.size(); ++i){
        const auto* face = meshFaces[i];
        if(face){
            json facetJson;
            json vertices = json::array();
            if(face->edges()){
                auto* edge = face->edges();
                do{
                    if(edge->vertex1()){
                        vertices.push_back(edge->vertex1()->index());
                    }
                    edge = edge->nextFaceEdge();
                }while(edge && edge != face->edges() && vertices.size() < 10); 
            }
            
            while(vertices.size() < 3){
                vertices.push_back(0);
            }

            if(vertices.size() > 3){
                vertices = json::array({vertices[0], vertices[1], vertices[2]});
            }
            
            facetJson["vertices"] = vertices;
            facets.push_back(facetJson);
        }
    }
    
    meshData["data"] = {
        {"points", points},
        {"edges", edges},
        {"facets", facets}
    };
    
    meshData["summary"] = {
        {"segment_facets", static_cast<int>(meshFaces.size())},
        {"connectivity_stats", {
            {"total_connections", static_cast<int>(edgeSet.size())},
            {"unique_segments", static_cast<int>(meshFaces.size())}
        }}
    };
    
    if(includeTopologyInfo){
        meshData["topology"] = {
            {"euler_characteristic", static_cast<int>(meshVertices.size()) - static_cast<int>(edgeSet.size()) + static_cast<int>(meshFaces.size())},
            {"average_vertex_degree", calculateAverageVertexDegree(interfaceMesh)},
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
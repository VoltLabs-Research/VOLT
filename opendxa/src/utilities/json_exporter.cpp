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
    const HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& defectMesh,
    const InterfaceMesh* interfaceMesh, 
    const LammpsParser::Frame& frame,
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes,
    bool includeDetailedNetworkInfo,
    bool includeTopologyInfo
){
    json data;

    data["dislocations"] = exportDislocationsToJson(network, includeDetailedNetworkInfo, &frame.simulationCell);
    data["defect_mesh"] = getMeshData(defectMesh, interfaceMesh->structureAnalysis(), false, nullptr);
    data["interface_mesh"] = getMeshData(*interfaceMesh, interfaceMesh->structureAnalysis(), true, interfaceMesh);
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

void clipDislocationLine(
    const std::deque<Point3>& line,
    const SimulationCell& simulationCell,
    const std::function<void(const Point3&, const Point3&, bool)>& segmentCallback
){
    if(line.size() < 2) return;
    bool isInitialSegment = true;

    // initialize the first point and the shift vector
    auto v1Iter = line.cbegin();
    Point3 rp1 = simulationCell.absoluteToReduced(*v1Iter);
    Vector3 shiftVector = Vector3::Zero();
    for(size_t dimension = 0; dimension < 3; dimension++){
        if(simulationCell.pbcFlags()[dimension]){
            // move the start point to the main box [0,1) and record the offset
            double shift = -std::floor(rp1[dimension]);
            rp1[dimension] += shift;
            shiftVector[dimension] += shift;
        }
    }

    // iterate over the original line segments
    for(auto v2Iter = v1Iter + 1; v2Iter != line.cend(); v1Iter = v2Iter, ++v2Iter){
        Point3 rp2 = simulationCell.absoluteToReduced(*v2Iter) + shiftVector;
        // ugly hack
        int maxIterations = 10;
        int iterationCount = 0;
        do{
            iterationCount++;
            if(iterationCount > maxIterations){
                segmentCallback(
                    simulationCell.reducedToAbsolute(rp1),
                    simulationCell.reducedToAbsolute(rp2),
                    isInitialSegment
                );
                break;
            }

            size_t crossDim = -1;
            double crossDir = 0;
            double smallestT = std::numeric_limits<double>::max();
            for(size_t dimension = 0; dimension < 3; dimension++){
                if(simulationCell.pbcFlags()[dimension]){
                    // crossing detection
                    int d = (int) std::floor(rp2[dimension]) - (int) std::floor(rp1[dimension]);
                    if(d == 0) continue;

                    double dr = rp2[dimension] - rp1[dimension];
                    if(std::abs(dr) < 1e-9) continue;

                    double t = (d > 0) ? (std::ceil(rp1[dimension]) - rp1[dimension]) / dr
                                       : (std::floor(rp1[dimension]) - rp1[dimension]) / dr;
                    if(t > 1e-9 && t < smallestT){
                        smallestT = t;
                        crossDim = dimension;
                        crossDir = (d > 0) ? 1.0 : -1.0;
                    }
                }
            }

            // tolerance to avoid very small intersections
            if(smallestT < (1.0 - 1e-9)){
                Point3 intersection = rp1 + smallestT * (rp2 - rp1);
                intersection[crossDim] = std::round(intersection[crossDim]);
                segmentCallback(simulationCell.reducedToAbsolute(rp1), simulationCell.reducedToAbsolute(intersection), isInitialSegment);
                shiftVector[crossDim] -= crossDir;
                rp1 = intersection;
                rp1[crossDim] -= crossDir;
                rp2[crossDim] -= crossDir;
                isInitialSegment = true;
            }else{
                // no more intersections for this segment
                segmentCallback(simulationCell.reducedToAbsolute(rp1), simulationCell.reducedToAbsolute(rp2), isInitialSegment);
                isInitialSegment = false;
                break;
            }
        }while(true);
        rp1 = rp2;
    }
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

    auto saveChunk = [&](const std::deque<Point3>& chunk, const DislocationSegment* originalSegment, int originalIndex){
        // if(chunk.size() < 2) return;
        json segmentJson;
        json points = json::array();

        segmentJson["segment_id"] = originalIndex;
        double chunkLength = 0.0;
        for(size_t pointIdx = 0; pointIdx < chunk.size(); ++pointIdx){
            points.push_back({ chunk[pointIdx].x(), chunk[pointIdx].y(), chunk[pointIdx].z() });
            if(pointIdx > 0){
                chunkLength += (chunk[pointIdx] - chunk[pointIdx - 1]).length();
            }
        }

        segmentJson["points"] = points;
        segmentJson["length"] = chunkLength;
        segmentJson["num_points"] = chunk.size();

        segmentJson["type"] = getDislocationType(originalSegment);
        Vector3 burgers = originalSegment->burgersVector.localVec();
        segmentJson["burgers"] = {
            {"vector", {burgers.x(), burgers.y(), burgers.z()}},
            {"magnitude", burgers.length()},
            {"fractional", getBurgersVectorString(burgers)}
        };

        dataArray.push_back(segmentJson);
        
        totalLength += chunkLength;
        totalPoints += chunk.size();
        maxLength = std::max(maxLength, chunkLength);
        minLength = std::min(minLength, chunkLength);
    };

    for(size_t i = 0; i < segments.size(); ++i){
        auto* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            std::deque<Point3> currentChunk;
            clipDislocationLine(segment->line, *simulationCell, 
                [&](const Point3& p1, const Point3& p2, bool isInitialSegment){
                    if(isInitialSegment && !currentChunk.empty()){
                        saveChunk(currentChunk, segment, i);
                        currentChunk.clear();
                    }

                    if(currentChunk.empty()){
                        currentChunk.push_back(p1);
                    }

                    currentChunk.push_back(p2);
            });

            saveChunk(currentChunk, segment, i);
        }
    }

    dislocations["metadata"]["count"] = dataArray.size();
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

template <typename MeshType>
json DXAJsonExporter::getMeshData(
    const MeshType& mesh,
    const StructureAnalysis& structureAnalysis,
    bool includeTopologyInfo,
    const InterfaceMesh* interfaceMeshForTopology
){
    json meshData;
    const auto& originalVertices = mesh.vertices(); 
    const auto& originalFaces = mesh.faces();
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
        assert(faceIndices.size() == 3 && "The mesh does not contain any triangular faces.");
        facets.push_back({
            {"vertices", faceIndices}
        });
    }

    meshData["data"] = {
        {"points", points},
        {"facets", facets}
    };
    
    if(includeTopologyInfo && interfaceMeshForTopology != nullptr){
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
            {"is_completely_good", interfaceMeshForTopology->isCompletelyGood()},
            {"is_completely_bad", interfaceMeshForTopology->isCompletelyBad()}
        };
    }
    
    return meshData;
}

json DXAJsonExporter::getAtomsData(
    const LammpsParser::Frame& frame, 
    const BurgersLoopBuilder* tracer,
    const std::vector<int>* structureTypes
){
    std::map<std::string, json> groupedAtoms;

    for(size_t i = 0; i < frame.natoms; ++i){
        int structureType = 0;
        if(structureTypes && i < static_cast<int>(structureTypes->size())){
            structureType = (*structureTypes)[i];
        }

        std::string typeName = tracer->mesh().structureAnalysis().getStructureTypeName(structureType);
        
        json atomJson;
        atomJson["id"] = i;

        if(tracer->mesh().structureAnalysis().usingPTM()){
            Quaternion quat = tracer->mesh().structureAnalysis().getPTMAtomOrientation(i);
            atomJson["ptm_quaternion"] = {quat.x(), quat.y(), quat.z(), quat.w()};
        }
        
        if(i < static_cast<int>(frame.positions.size())){
            const auto& pos = frame.positions[i];
            atomJson["pos"] = {pos.x(), pos.y(), pos.z()};
        }else{
            atomJson["pos"] = {0.0, 0.0, 0.0};
        }
        
        if(!groupedAtoms[typeName].is_array()){
            groupedAtoms[typeName] = json::array();
        }

        groupedAtoms[typeName].push_back(atomJson);
    }
    
    return json(groupedAtoms);
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
    for(size_t i = 0; i < 3; ++i){
        json row = json::array();
        for(size_t j = 0; j < 3; ++j){
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
            for(size_t coreSize : segment->coreSize){
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
#include <opendxa/core/clustering.hpp>
#include <opendxa/core/interface_mesh.hpp>
#include <opendxa/core/dislocation_tracing.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/utils/burgers.hpp>
#include <sstream>
#include <algorithm>
#include <numeric>
#include <chrono>
#include <iomanip>

json createStandardStructureOptimized(){
    json root;
    root["metadata"] = json::object();
    root["data"] = json::array();
    root["summary"] = json::object();
    return root;
}

json createMetadataOptimized(const std::string& type, size_t count, const std::string& description = ""){
    json metadata;
    metadata["type"] = type;
    metadata["count"] = count;
    
    if(!description.empty()){
        metadata["description"] = description;
    }
    return metadata;
}

// Fixed helper to reserve arrays safely
void reserveArray(json& arr, size_t size){
    if(arr.is_array()){
        try{
            auto& vec = arr.get_ref<json::array_t&>();
            vec.reserve(size);
        }catch (...){
            // Fallback, just ignore if reserve fails
        }
    }
}

json DXATracing::exportDislocationsToJson() const{
    json root = createStandardStructureOptimized();
    
    root["metadata"] = createMetadataOptimized(
        "dislocation_segments", 
        segments.size(), 
        "Dislocation line segments with Burgers vector information"
    );
    
    reserveArray(root["data"], segments.size());
    
    size_t total_points = 0;
    double total_length = 0.0;
    std::vector<double> lengths;
    lengths.reserve(segments.size());
    
    for(const auto* segment : segments){
        json segmentData;
        
        const size_t num_points = segment->line.size();
        const double length = segment->calculateLength();
        
        segmentData["index"] = segment->index;
        segmentData["point_index_offset"] = total_points;
        segmentData["num_points"] = num_points;
        segmentData["length"] = length;
        
        json points = json::array();
        reserveArray(points, num_points);
        for (const auto& p : segment->line) {
            points.emplace_back(json::array({p.X, p.Y, p.Z}));
        }
        segmentData["points"] = std::move(points);
        
        const auto& bv = segment->burgersVector;
        const auto& bw = segment->burgersVectorWorld;
        const double magnitude = std::sqrt(static_cast<double>(bv.X*bv.X + bv.Y*bv.Y + bv.Z*bv.Z));
        
        segmentData["burgers"]["vector"] = json::array({bv.X, bv.Y, bv.Z});
        segmentData["burgers"]["vector_world"] = json::array({bw.X, bw.Y, bw.Z});
        segmentData["burgers"]["magnitude"] = magnitude;
        segmentData["burgers"]["fractional"] = burgersToFractionalString(bv);
        
        if(segment->circuits[0] != nullptr || segment->circuits[1] != nullptr){
            json circuits = json::array();
            reserveArray(circuits, 2);
            
            if(segment->circuits[0] != nullptr){
                json circuit = segment->circuits[0]->getBurgersCircuit();
                circuit["type"] = "forward";
                circuits.emplace_back(std::move(circuit));
            }
            
            if(segment->circuits[1] != nullptr){
                json circuit = segment->circuits[1]->getBurgersCircuit();
                circuit["type"] = "backward";
                circuits.emplace_back(std::move(circuit));
            }
            
            segmentData["burgers_circuits"] = std::move(circuits);
        }
        
        root["data"].emplace_back(std::move(segmentData));
        
        total_points += num_points;
        total_length += length;
        lengths.emplace_back(length);
    }
    
    root["summary"]["total_points"] = total_points;
    root["summary"]["average_segment_length"] = segments.empty() ? 0.0 : total_length / segments.size();
    root["summary"]["max_segment_length"] = segments.empty() ? 0.0 : *std::max_element(lengths.begin(), lengths.end());
    root["summary"]["min_segment_length"] = segments.empty() ? 0.0 : *std::min_element(lengths.begin(), lengths.end());
    root["summary"]["total_length"] = total_length;
    root["summary"]["segments_with_circuits"] = std::count_if(segments.begin(), segments.end(), 
        [](const auto* seg) { return seg->circuits[0] || seg->circuits[1]; });
    root["summary"]["memory_optimization"] = "reserve_enabled";
    
    return root;
}

json DXAClustering::getAtomsData(){
    json root = createStandardStructureOptimized();
    
    root["metadata"] = createMetadataOptimized(
        "atomic_structure", 
        inputAtoms.size(),
        "Atomic structure with CNA classification"
    );
    
    reserveArray(root["data"], inputAtoms.size());
    
    std::unordered_map<int, int> cna_type_counts;
    std::unordered_map<int, int> coordination_counts;
    cna_type_counts.reserve(10);
    coordination_counts.reserve(20);
    
    for(const auto& atom : inputAtoms){
        json atomData;
        atomData["node_id"] = atom.tag;
        atomData["position"] = json::array({atom.pos.X, atom.pos.Y, atom.pos.Z});
        atomData["cna"]["atom_type"] = static_cast<int>(atom.cnaType);
        atomData["coordination"] = atom.numNeighbors;
        atomData["recursive_depth"] = atom.recursiveDepth;
        
        root["data"].emplace_back(std::move(atomData));
        
        cna_type_counts[atom.cnaType]++;
        coordination_counts[atom.numNeighbors]++;
    }
    
    json cna_distribution = json::object();
    json coordination_distribution = json::object();
    
    for(const auto& pair : cna_type_counts){
        cna_distribution[std::to_string(pair.first)] = pair.second;
    }
    
    for(const auto& pair : coordination_counts){
        coordination_distribution[std::to_string(pair.first)] = pair.second;
    }
    
    int total_coordination = std::accumulate(coordination_counts.begin(), coordination_counts.end(), 0,
        [](int sum, const auto& pair) { return sum + pair.first * pair.second; });
    
    auto most_common_cna = std::max_element(cna_type_counts.begin(), cna_type_counts.end(),
        [](const auto& a, const auto& b) { return a.second < b.second; });
    
    auto coord_minmax = std::minmax_element(coordination_counts.begin(), coordination_counts.end());
    int coord_range = coordination_counts.empty() ? 0 : coord_minmax.second->first - coord_minmax.first->first;
    
    root["summary"]["cna_type_distribution"] = std::move(cna_distribution);
    root["summary"]["coordination_distribution"] = std::move(coordination_distribution);
    root["summary"]["most_common_cna_type"] = most_common_cna != cna_type_counts.end() ? most_common_cna->first : -1;
    root["summary"]["average_coordination"] = inputAtoms.empty() ? 0.0 : static_cast<double>(total_coordination) / inputAtoms.size();
    root["summary"]["unique_cna_types"] = cna_type_counts.size();
    root["summary"]["coordination_range"] = coord_range;
    
    return root;
}

json DXAInterfaceMesh::getInterfaceMeshData(){
    json root = createStandardStructureOptimized();
    
    size_t numValidFacets = 0;
    size_t numValidEdges = 0;
    
    for(auto* facet : facets){
        if(!isWrappedFacet(facet)){
            numValidFacets++;
        }
    }
    
    for(auto* node : nodes){
        for(int i = 0; i < node->numEdges; i++){
            if(!isWrappedEdge(&node->edges[i])){
                numValidEdges++;
            }
        }
    }
    
    root["metadata"] = createMetadataOptimized(
        "interface_mesh", 
        nodes.size() + numValidFacets + numValidEdges,
        "Interface mesh with nodes, edges, and facets"
    );
    root["metadata"]["components"]["num_nodes"] = nodes.size();
    root["metadata"]["components"]["num_facets"] = numValidFacets;
    root["metadata"]["components"]["num_edges"] = numValidEdges;
    
    root["data"] = json::object();
    root["data"]["points"] = json::array();
    root["data"]["edges"] = json::array();
    root["data"]["facets"] = json::array();
    
    reserveArray(root["data"]["points"], nodes.size());
    reserveArray(root["data"]["edges"], numValidEdges);
    reserveArray(root["data"]["facets"], numValidFacets);
    
    // Points
    for(const auto* node : nodes){
        json pointData;
        pointData["index"] = node->index;
        pointData["position"] = json::array({node->pos.X, node->pos.Y, node->pos.Z});
        root["data"]["points"].emplace_back(std::move(pointData));
    }
    
    std::unordered_map<int, int> edge_count_distribution;
    edge_count_distribution.reserve(10);
    int sf_edge_count = 0;
    
    for(auto* node : nodes){
        for(int i = 0; i < node->numEdges; i++){
            if(!isWrappedEdge(&node->edges[i])){
                int count = 0;
                for(int c = 0; c < node->numEdges; c++){
                    if(node->edgeNeighbor(c) == node->edgeNeighbor(i)){
                        count++;
                    }
                }
                
                bool is_sf = node->edges[i].isSFEdge;
                if(is_sf) sf_edge_count++;
                
                json edgeData;
                edgeData["vertices"] = json::array({node->index, node->edgeNeighbor(i)->index});
                edgeData["edge_count"] = count;
                edgeData["is_stacking_fault"] = is_sf;
                
                root["data"]["edges"].emplace_back(std::move(edgeData));
                edge_count_distribution[count]++;
            }
        }
    }
    
    // Facets
    std::unordered_map<int, int> segment_distribution;
    segment_distribution.reserve(100);
    int primary_segment_count = 0;
    
    for(auto* facet : facets){
        if(!isWrappedFacet(facet)){
            int segment_id = -1;
            int final_segment_id = -1;
            bool is_primary = facet->testFlag(FACET_IS_PRIMARY_SEGMENT);
            
            if(facet->circuit != nullptr){
                segment_id = facet->circuit->segment->index;
                
                if(!facet->circuit->isDangling || is_primary){
                    DislocationSegment* segment = facet->circuit->segment;
                    while(segment->replacedWith != nullptr){
                        segment = segment->replacedWith;
                    }
                    final_segment_id = segment->index;
                }
            }
            
            json facetData;
            facetData["vertices"] = json::array({
                facet->vertex(0)->index,
                facet->vertex(1)->index,
                facet->vertex(2)->index
            });
            facetData["segment"] = segment_id;
            facetData["final_segment"] = final_segment_id;
            facetData["is_primary_segment"] = is_primary;
            facetData["selection"] = facet->selection;
            
            root["data"]["facets"].emplace_back(std::move(facetData));
            
            if(segment_id >= 0){
                segment_distribution[segment_id]++;
            }

            if(is_primary){
                primary_segment_count++;
            }
        }
    }
    
    // Summary
    json edge_count_dist = json::object();
    json segment_dist = json::object();
    
    for(const auto& pair : edge_count_distribution){
        edge_count_dist[std::to_string(pair.first)] = pair.second;
    }
    
    for(const auto& pair : segment_distribution){
        segment_dist[std::to_string(pair.first)] = pair.second;
    }
    
    root["summary"]["stacking_fault_edges"] = sf_edge_count;
    root["summary"]["stacking_fault_ratio"] = numValidEdges > 0 ? static_cast<double>(sf_edge_count) / numValidEdges : 0.0;
    root["summary"]["primary_segment_facets"] = primary_segment_count;
    root["summary"]["edge_count_distribution"] = std::move(edge_count_dist);
    root["summary"]["segment_distribution"] = std::move(segment_dist);
    root["summary"]["connectivity_stats"]["total_connections"] = static_cast<int>(edge_count_distribution.size());
    root["summary"]["connectivity_stats"]["max_edge_multiplicity"] = edge_count_distribution.empty() ? 0 : 
        std::max_element(edge_count_distribution.begin(), edge_count_distribution.end())->first;
    root["summary"]["connectivity_stats"]["unique_segments"] = segment_distribution.size();
    
    return root;
}

json DXAStackingFaults::getStackingFaults() const{
    json root = createStandardStructureOptimized();
    
    root["metadata"] = createMetadataOptimized(
        "stacking_faults", 
        stackingFaults.size(),
        "Stacking fault defects with geometric properties"
    );
    
    reserveArray(root["data"], stackingFaults.size());
    
    // Statistics
    int invalid_count = 0;
    std::vector<int> hcp_atoms, isf_atoms, tb_atoms;
    hcp_atoms.reserve(stackingFaults.size());
    isf_atoms.reserve(stackingFaults.size());
    tb_atoms.reserve(stackingFaults.size());
    
    // Process stacking faults
    for(const auto* sf : stackingFaults){
        json data = sf->getStackingFault();
        data["index"] = sf->index;
        data["is_invalid"] = sf->isInvalid;
        data["normal_vector"] = json::array({sf->normalVector.X, sf->normalVector.Y, sf->normalVector.Z});
        data["center"] = json::array({sf->center.X, sf->center.Y, sf->center.Z});
        data["base_point"] = json::array({sf->basePoint.X, sf->basePoint.Y, sf->basePoint.Z});
        data["atom_counts"]["hcp"] = sf->numHCPAtoms;
        data["atom_counts"]["isf"] = sf->numISFAtoms;
        data["atom_counts"]["twin_boundary"] = sf->numTBAtoms;
        data["is_infinite"] = json::array({sf->isInfinite[0], sf->isInfinite[1], sf->isInfinite[2]});
        
        root["data"].emplace_back(std::move(data));
        
        // Collect statistics
        if(sf->isInvalid) invalid_count++;
        hcp_atoms.emplace_back(sf->numHCPAtoms);
        isf_atoms.emplace_back(sf->numISFAtoms);
        tb_atoms.emplace_back(sf->numTBAtoms);
    }
    
    // Summary with optimized statistics calculation
    auto calc_stats = [](const std::vector<int>& vec) -> json{
        if(vec.empty()) return json::object();
        auto minmax = std::minmax_element(vec.begin(), vec.end());
        int sum = std::accumulate(vec.begin(), vec.end(), 0);
        json stats;
        stats["min"] = *minmax.first;
        stats["max"] = *minmax.second;
        stats["mean"] = static_cast<double>(sum) / vec.size();
        stats["total"] = sum;
        stats["count"] = vec.size();
        return stats;
    };
    
    int total_atoms = std::accumulate(hcp_atoms.begin(), hcp_atoms.end(), 0) +
                    std::accumulate(isf_atoms.begin(), isf_atoms.end(), 0) +
                    std::accumulate(tb_atoms.begin(), tb_atoms.end(), 0);
    
    root["summary"]["invalid_faults"] = invalid_count;
    root["summary"]["validity_ratio"] = stackingFaults.empty() ? 1.0 : 
        static_cast<double>(stackingFaults.size() - invalid_count) / stackingFaults.size();
    root["summary"]["atom_statistics"]["hcp"] = calc_stats(hcp_atoms);
    root["summary"]["atom_statistics"]["isf"] = calc_stats(isf_atoms);
    root["summary"]["atom_statistics"]["twin_boundary"] = calc_stats(tb_atoms);
    root["summary"]["fault_density"]["faults_per_1000_atoms"] = total_atoms > 0 ? 1000.0 * stackingFaults.size() / total_atoms : 0.0;
    root["summary"]["fault_density"]["total_affected_atoms"] = total_atoms;
    
    return root;
}

json OutputMesh::getOutputMeshData(){
    json root = createStandardStructureOptimized();
    
    root["metadata"] = createMetadataOptimized(
        "output_mesh", 
        vertices.size() + facets.size(),
        "Output mesh for visualization"
    );
    root["metadata"]["components"]["num_vertices"] = vertices.size();
    root["metadata"]["components"]["num_facets"] = facets.size();
    
    root["data"] = json::object();
    root["data"]["vertices"] = json::array();
    root["data"]["facets"] = json::array();
    
    root["point_data"] = json::object();
    root["point_data"]["normals"] = json::array();
    root["cell"] = json::object();
    root["cell"]["entity"] = json::array();
    root["cell"]["disclination_barrier"] = json::array();
    
    reserveArray(root["data"]["vertices"], vertices.size());
    reserveArray(root["data"]["facets"], facets.size());
    reserveArray(root["point_data"]["normals"], vertices.size());
    reserveArray(root["cell"]["entity"], facets.size());
    reserveArray(root["cell"]["disclination_barrier"], facets.size());
    
    for(const auto* vertex : vertices){
        json vertexData;
        vertexData["index"] = vertex->index;
        vertexData["position"] = json::array({vertex->pos.X, vertex->pos.Y, vertex->pos.Z});
        vertexData["normal"] = json::array({vertex->normal.X, vertex->normal.Y, vertex->normal.Z});
        
        root["data"]["vertices"].emplace_back(std::move(vertexData));
        root["point_data"]["normals"].emplace_back(json::array({vertex->normal.X, vertex->normal.Y, vertex->normal.Z}));
    }
    
    // Facets
    std::unordered_map<int, int> entity_distribution;
    entity_distribution.reserve(50);
    int disclination_barrier_count = 0;
    
    for(const auto* facet : facets){
        bool is_barrier = facet->testFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER);
        
        json facetData;
        facetData["vertices"] = json::array({
            facet->edges[0]->vertex2->index,
            facet->edges[1]->vertex2->index,
            facet->edges[2]->vertex2->index
        });
        facetData["entity"] = facet->entity;
        facetData["disclination_barrier"] = is_barrier;
        
        root["data"]["facets"].emplace_back(std::move(facetData));
        
        root["cell"]["entity"].emplace_back(facet->entity);
        root["cell"]["disclination_barrier"].emplace_back(is_barrier);
        
        entity_distribution[facet->entity]++;
        if(is_barrier) disclination_barrier_count++;
    }
    
    // Summary
    json entity_dist = json::object();
    for(const auto& pair : entity_distribution){
        entity_dist[std::to_string(pair.first)] = pair.second;
    }
    
    double avg_entity = entity_distribution.empty() ? 0.0 :
        static_cast<double>(std::accumulate(entity_distribution.begin(), entity_distribution.end(), 0,
            [](int sum, const auto& pair) { return sum + pair.first * pair.second; })) / facets.size();
    
    root["summary"]["disclination_barriers"] = disclination_barrier_count;
    root["summary"]["barrier_ratio"] = facets.empty() ? 0.0 : 
        static_cast<double>(disclination_barrier_count) / facets.size();
    root["summary"]["entity_distribution"] = std::move(entity_dist);
    root["summary"]["mesh_quality"]["vertex_to_facet_ratio"] = vertices.empty() ? 0.0 : static_cast<double>(facets.size()) / vertices.size();
    root["summary"]["mesh_quality"]["average_facet_entity"] = avg_entity;
    root["summary"]["mesh_quality"]["unique_entities"] = entity_distribution.size();
    
    return root;
}

json BurgersCircuit::getBurgersCircuit(){
    json root = createStandardStructureOptimized();
    
    // Metadata
    root["metadata"] = createMetadataOptimized(
        "burgers_circuit", 
        edgeCount,
        "Burgers circuit for dislocation analysis"
    );
    
    // Create data structure
    root["data"] = json::object();
    root["data"]["points"] = json::array();
    root["data"]["edges"] = json::array();
    root["data"]["lattice_vectors"] = json::array();
    
    reserveArray(root["data"]["points"], edgeCount);
    reserveArray(root["data"]["edges"], edgeCount);
    reserveArray(root["data"]["lattice_vectors"], edgeCount);
    
    MeshEdge* edge = firstEdge;
    int pointIndex = 0;
    Vector3 totalBurgers = {0.0, 0.0, 0.0};
    
    do{
        // Calculate visualization position
        Point3 vizpos = edge->node1->pos;
        
        // Offset based on adjacent facets
        if(edge->facet){
            Vector3 normal = CrossProduct(
                edge->facet->vertex(2)->pos - edge->facet->vertex(0)->pos, 
                edge->facet->vertex(1)->pos - edge->facet->vertex(0)->pos
            );
            vizpos += NormalizeSafely(normal) * 0.05;
        }
        if(edge->oppositeEdge && edge->oppositeEdge->facet){
            Vector3 normal = CrossProduct(
                edge->oppositeEdge->facet->vertex(2)->pos - edge->oppositeEdge->facet->vertex(0)->pos, 
                edge->oppositeEdge->facet->vertex(1)->pos - edge->oppositeEdge->facet->vertex(0)->pos
            );
            vizpos += NormalizeSafely(normal) * 0.05;
        }
        
        // Point data
        json pointData;
        pointData["index"] = pointIndex;
        pointData["position"] = json::array({vizpos.X, vizpos.Y, vizpos.Z});
        pointData["original_position"] = json::array({edge->node1->pos.X, edge->node1->pos.Y, edge->node1->pos.Z});
        pointData["lattice_vector"] = json::array({edge->latticeVector[0], edge->latticeVector[1], edge->latticeVector[2]});
        
        root["data"]["points"].emplace_back(std::move(pointData));
        
        // Edge connectivity
        json edgeData;
        edgeData["index"] = pointIndex;
        edgeData["vertices"] = json::array({pointIndex, (pointIndex + 1) % edgeCount});
        
        root["data"]["edges"].emplace_back(std::move(edgeData));
        
        // Lattice vector
        root["data"]["lattice_vectors"].emplace_back(json::array({
            edge->latticeVector[0], edge->latticeVector[1], edge->latticeVector[2]
        }));
        
        // Accumulate total Burgers vector
        totalBurgers.X += edge->latticeVector[0];
        totalBurgers.Y += edge->latticeVector[1];
        totalBurgers.Z += edge->latticeVector[2];
        
        edge = edge->nextEdge;
        pointIndex++;
    }while(edge != firstEdge);
    
    // Summary
    double magnitude = std::sqrt(totalBurgers.X*totalBurgers.X + 
                                totalBurgers.Y*totalBurgers.Y + 
                                totalBurgers.Z*totalBurgers.Z);
    
    root["summary"]["burgers_vector"] = json::array({totalBurgers.X, totalBurgers.Y, totalBurgers.Z});
    root["summary"]["burgers_magnitude"] = magnitude;
    root["summary"]["is_closed"] = magnitude < 1e-10;
    root["summary"]["circuit_quality"]["closure_error"] = magnitude;
    root["summary"]["circuit_quality"]["normalized_closure_error"] = edgeCount > 0 ? magnitude / edgeCount : 0.0;
    root["summary"]["circuit_quality"]["edge_count"] = edgeCount;
    
    return root;
}

json StackingFaultContour::getStackingFaultContour() const{
    json root = createStandardStructureOptimized();
    
    // Metadata
    root["metadata"] = createMetadataOptimized(
        "stacking_fault_contour", 
        edges.size(),
        "Contour of a stacking fault"
    );
    root["metadata"]["num_points"] = edges.size() * 2;
    
    // Create data structure
    root["data"] = json::object();
    root["data"]["points"] = json::array();
    root["data"]["edges"] = json::array();
    
    // Cell data
    root["cell"] = json::object();
    root["cell"]["edge_indices"] = json::array();
    root["cell"]["facet_determinants"] = json::array();
    root["cell"]["node_indices"] = json::array();
    root["cell"]["stacking_fault_flags"] = json::array();
    
    // RESERVE all arrays
    reserveArray(root["data"]["points"], edges.size() * 2);
    reserveArray(root["data"]["edges"], edges.size());
    reserveArray(root["cell"]["edge_indices"], edges.size());
    reserveArray(root["cell"]["facet_determinants"], edges.size());
    reserveArray(root["cell"]["node_indices"], edges.size());
    reserveArray(root["cell"]["stacking_fault_flags"], edges.size());
    
    std::vector<FloatType> valid_determinants;
    valid_determinants.reserve(edges.size());
    int sf_edge_count = 0;
    
    int pointIndex = 0;
    int edgeIndex = 0;
    
    for(auto* edge : edges){
        // Points (2 per edge)
        json startPoint;
        startPoint["index"] = pointIndex++;
        startPoint["position"] = json::array({edge->node1->pos.X, edge->node1->pos.Y, edge->node1->pos.Z});
        startPoint["node_id"] = edge->node1->tag;
        startPoint["role"] = "start";
        
        json endPoint;
        endPoint["index"] = pointIndex++;
        endPoint["position"] = json::array({edge->node2()->pos.X, edge->node2()->pos.Y, edge->node2()->pos.Z});
        endPoint["node_id"] = edge->node2()->tag;
        endPoint["role"] = "end";
        
        root["data"]["points"].emplace_back(std::move(startPoint));
        root["data"]["points"].emplace_back(std::move(endPoint));
        
        // Edge connectivity
        json edgeData;
        edgeData["vertices"] = json::array({edgeIndex * 2, edgeIndex * 2 + 1});
        edgeData["edge_index"] = edgeIndex;
        
        root["data"]["edges"].emplace_back(std::move(edgeData));
        
        // Cell data
        root["cell"]["edge_indices"].emplace_back(edgeIndex);
        
        // Facet determinant calculation
        FloatType facet_det = 0.0;
        MeshFacet* facet1 = edge->facet;
        MeshFacet* facet2 = edge->oppositeEdge ? edge->oppositeEdge->facet : nullptr;
        
        if(facet1 && facet2){
            MeshEdge* node1edge = facet1->previousEdge(const_cast<MeshEdge*>(edge))->oppositeEdge;
            MeshEdge* node2edge = facet2->nextEdge(edge->oppositeEdge);
            
            facet_det = Matrix3(
                edge->latticeVector, 
                node1edge->latticeVector, 
                node2edge->latticeVector
            ).determinant();
            
            if(std::abs(facet_det) > 1e-10){
                valid_determinants.emplace_back(facet_det);
            }
        }
        
        root["cell"]["facet_determinants"].emplace_back(facet_det);
        root["cell"]["node_indices"].emplace_back(edge->node1->tag);
        
        bool is_sf = edge->isSFEdge;
        root["cell"]["stacking_fault_flags"].emplace_back(is_sf);
        if(is_sf) sf_edge_count++;
        
        edgeIndex++;
    }
    
    // Summary statistics
    json determinant_stats = json::object();
    if(!valid_determinants.empty()){
        auto minmax = std::minmax_element(valid_determinants.begin(), valid_determinants.end());
        FloatType sum = std::accumulate(valid_determinants.begin(), valid_determinants.end(), 0.0);
        
        // Calculate standard deviation
        double mean = sum / valid_determinants.size();
        double sq_sum = std::accumulate(valid_determinants.begin(), valid_determinants.end(), 0.0,
            [mean](double acc, FloatType val) { return acc + (val - mean) * (val - mean); });
        double std_dev = valid_determinants.size() > 1 ? std::sqrt(sq_sum / (valid_determinants.size() - 1)) : 0.0;
        
        determinant_stats["min"] = *minmax.first;
        determinant_stats["max"] = *minmax.second;
        determinant_stats["mean"] = mean;
        determinant_stats["count"] = valid_determinants.size();
        determinant_stats["std_deviation"] = std_dev;
        determinant_stats["range"] = *minmax.second - *minmax.first;
    }
    
    root["summary"]["stacking_fault_edge_count"] = sf_edge_count;
    root["summary"]["stacking_fault_ratio"] = edges.empty() ? 0.0 : static_cast<double>(sf_edge_count) / edges.size();
    root["summary"]["facet_determinant_stats"] = std::move(determinant_stats);
    root["summary"]["contour_properties"]["perimeter_edges"] = static_cast<int>(edges.size());
    root["summary"]["contour_properties"]["geometric_closure"] = edges.empty() ? true : (pointIndex / 2) == static_cast<int>(edges.size());
    root["summary"]["contour_properties"]["contour_complexity"] = edges.empty() ? 0.0 : static_cast<double>(sf_edge_count) / edges.size();
    
    return root;
}

json StackingFault::getStackingFault() const{
    json root = createStandardStructureOptimized();
    
    // Metadata
    root["metadata"] = createMetadataOptimized(
        "stacking_fault", 
        contours.size(),
        "Complete stacking fault with all contours"
    );
    
    // Calculate totals
    size_t total_edges = 0;
    size_t total_points = 0;
    for(const auto& contour : contours){
        total_edges += contour.edges.size();
        total_points += contour.edges.size() * 2;
    }
    
    root["metadata"]["totals"]["edges"] = total_edges;
    root["metadata"]["totals"]["points"] = total_points;
    
    root["data"] = json::object();
    root["data"]["contours"] = json::array();
    root["data"]["consolidated"] = json::object();
    root["data"]["consolidated"]["points"] = json::array();
    root["data"]["consolidated"]["edges"] = json::array();
    root["data"]["consolidated"]["cell"] = json::object();
    root["data"]["consolidated"]["cell"]["contour_ids"] = json::array();
    root["data"]["consolidated"]["cell"]["edge_indices_local"] = json::array();
    root["data"]["consolidated"]["cell"]["edge_indices_global"] = json::array();
    
    reserveArray(root["data"]["contours"], contours.size());
    reserveArray(root["data"]["consolidated"]["points"], total_points);
    reserveArray(root["data"]["consolidated"]["edges"], total_edges);
    reserveArray(root["data"]["consolidated"]["cell"]["contour_ids"], total_edges);
    reserveArray(root["data"]["consolidated"]["cell"]["edge_indices_local"], total_edges);
    reserveArray(root["data"]["consolidated"]["cell"]["edge_indices_global"], total_edges);
    
    // Individual contours
    for(size_t i = 0; i < contours.size(); ++i) {
        json contour_data = contours[i].getStackingFaultContour();
        contour_data["contour_id"] = i;
        root["data"]["contours"].emplace_back(std::move(contour_data));
    }
    
    // Consolidated data
    int global_point_index = 0;
    int global_edge_index = 0;
    
    for(size_t contour_id = 0; contour_id < contours.size(); ++contour_id){
        const auto& contour = contours[contour_id];
        
        for(size_t local_edge_idx = 0; local_edge_idx < contour.edges.size(); ++local_edge_idx){
            MeshEdge* edge = contour.edges[local_edge_idx];
            
            // Add points (2 per edge)
            Point3 pos1 = edge->node1->outputVertex ? edge->node1->outputVertex->pos : edge->node1->pos;
            Point3 pos2 = edge->node2()->outputVertex ? edge->node2()->outputVertex->pos : edge->node2()->pos;
            
            json point1;
            point1["index"] = global_point_index++;
            point1["contour_id"] = contour_id;
            point1["position"] = json::array({pos1.X, pos1.Y, pos1.Z});
            point1["node_id"] = edge->node1->tag;
            
            json point2;
            point2["index"] = global_point_index++;
            point2["contour_id"] = contour_id;
            point2["position"] = json::array({pos2.X, pos2.Y, pos2.Z});
            point2["node_id"] = edge->node2()->tag;
            
            root["data"]["consolidated"]["points"].emplace_back(std::move(point1));
            root["data"]["consolidated"]["points"].emplace_back(std::move(point2));
            
            // Add edge
            json edgeData;
            edgeData["vertices"] = json::array({global_edge_index * 2, global_edge_index * 2 + 1});
            edgeData["contour_id"] = contour_id;
            edgeData["edge_index_global"] = global_edge_index;
            
            root["data"]["consolidated"]["edges"].emplace_back(std::move(edgeData));
            
            // Cell data
            root["data"]["consolidated"]["cell"]["contour_ids"].emplace_back(contour_id);
            root["data"]["consolidated"]["cell"]["edge_indices_local"].emplace_back(local_edge_idx);
            root["data"]["consolidated"]["cell"]["edge_indices_global"].emplace_back(global_edge_index);
            
            global_edge_index++;
        }
    }
    
    // Global summary statistics
    int total_sf_edges = 0;
    std::vector<FloatType> all_facet_determinants;
    all_facet_determinants.reserve(total_edges);
    
    for(const auto& contour_json : root["data"]["contours"]) {
        if(contour_json.contains("summary") && contour_json["summary"].contains("stacking_fault_edge_count")){
            total_sf_edges += contour_json["summary"]["stacking_fault_edge_count"].get<int>();
        }
        
        if(contour_json.contains("cell") && contour_json["cell"].contains("facet_determinants")){
            for(const auto& det : contour_json["cell"]["facet_determinants"]) {
                FloatType det_val = det.get<FloatType>();
                if(std::abs(det_val) > 1e-10) {
                    all_facet_determinants.emplace_back(det_val);
                }
            }
        }
    }
    
    json global_determinant_stats = json::object();
    if(!all_facet_determinants.empty()){
        auto minmax = std::minmax_element(all_facet_determinants.begin(), all_facet_determinants.end());
        FloatType sum = std::accumulate(all_facet_determinants.begin(), all_facet_determinants.end(), 0.0);
        
        global_determinant_stats["min"] = *minmax.first;
        global_determinant_stats["max"] = *minmax.second;
        global_determinant_stats["mean"] = sum / all_facet_determinants.size();
        global_determinant_stats["count"] = all_facet_determinants.size();
    }
    
    double avg_contour_size = contours.empty() ? 0.0 : static_cast<double>(total_edges) / contours.size();
    double contour_variance = 0.0;
    if(contours.size() > 1){
        for(const auto& contour : contours) {
            double diff = contour.edges.size() - avg_contour_size;
            contour_variance += diff * diff;
        }
        contour_variance /= (contours.size() - 1);
    }
    
    root["summary"]["total_contours"] = contours.size();
    root["summary"]["total_edges"] = total_edges;
    root["summary"]["total_points"] = total_points;
    root["summary"]["total_stacking_fault_edges"] = total_sf_edges;
    root["summary"]["overall_stacking_fault_ratio"] = total_edges > 0 ? static_cast<double>(total_sf_edges) / total_edges : 0.0;
    root["summary"]["global_facet_determinant_stats"] = std::move(global_determinant_stats);
    root["summary"]["fault_complexity"]["average_contour_size"] = avg_contour_size;
    root["summary"]["fault_complexity"]["contour_size_variance"] = contour_variance;
    root["summary"]["fault_complexity"]["complexity_index"] = contours.empty() ? 0.0 : std::sqrt(contour_variance) / avg_contour_size;
    
    return root;
}
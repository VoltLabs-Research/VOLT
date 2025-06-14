#include <opendxa/core/clustering.hpp>
#include <opendxa/core/interface_mesh.hpp>
#include <opendxa/core/dislocation_tracing.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/utils/burgers.hpp>
#include <sstream>

json DXATracing::exportDislocationsToJson() const{
	json root;
    root["num_segments"] = segments.size();
    json segs = json::array();
    size_t idx_offset = 0;
    for(auto* segment : segments){
        json pts = json::array();
        for (auto const& p : segment->line){
			pts.push_back({ p.X, p.Y, p.Z });
        }
        auto bv = segment->burgersVector;
        auto bw = segment->burgersVectorWorld;
        double mag = std::sqrt(double(bv.X*bv.X + bv.Y*bv.Y + bv.Z*bv.Z));
        json s;
        s["index"] = segment->index;
        s["point_index_offset"] = idx_offset;
        s["num_points"] = pts.size();
        s["points"] = std::move(pts);
        s["length"] = segment->calculateLength();
        s["burgers_vector"] = { bv.X, bv.Y, bv.Z };
        s["burgers_vector_world"] = { bw.X, bw.Y, bw.Z };
        s["burgers_vector_magnitude"] = mag;
        s["fractional_burgers"] = burgersToFractionalString(bv);

		// Burgers circuits data
		json circuits = json::array();
		if(segment->circuits[0] != nullptr){
			json forwardCircuit = segment->circuits[0]->getBurgersCircuit();
			forwardCircuit["type"] = "forward";
			circuits.push_back(forwardCircuit);
		}

		if(segment->circuits[1] != nullptr){
			json backwardCircuit = segment->circuits[1]->getBurgersCircuit();
			backwardCircuit["type"] = "backward";
			circuits.push_back(backwardCircuit);
		}
		s["burgers_circuit"] = circuits;

        segs.push_back(std::move(s));
        idx_offset += segment->line.size();
    }
    root["segments"] = std::move(segs);

	return root;
}

json DXAClustering::getAtomsData(){
	json root;
	json atoms = json::array();

	root["metadata"]["num_atoms"] = inputAtoms.size();

	for(vector<InputAtom>::const_iterator p = inputAtoms.begin(); p != inputAtoms.end(); ++p){
		json atom;
		atom["node_id"] = p->tag;
		atom["position"] = { p->pos.X, p->pos.Y, p->pos.Z };
		atom["cna"]["atom_type"] = p->cnaType;
		atom["coordination"] = p->numNeighbors;
		atom["recursive_depth"] = p->recursiveDepth;
		atoms.push_back(atom);
	}

	root["data"] = std::move(atoms);

	return root;
}

json DXAInterfaceMesh::getInterfaceMeshData(){
    json meshJson;

    // Count uninvolved facets and edges
    size_t numFacets = 0;
    for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f){
        if(isWrappedFacet(*f) == false){
            numFacets++;
		}
    }
    
    size_t numEdges = 0;
    for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n){
        for(int i = 0; i < (*n)->numEdges; i++){
            if(isWrappedEdge(&(*n)->edges[i]) == false){
                numEdges++;
			}
        }
    }
    
    // General information
    meshJson["metadata"]["num_nodes"] = nodes.size();
    meshJson["metadata"]["num_facets"] = numFacets;
    meshJson["metadata"]["num_edges"] = numEdges;
    meshJson["metadata"]["total_cells"] = numEdges + numFacets;
    
    // Points/Nodes
    meshJson["points"] = nlohmann::json::array();
    for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
        const Point3& pos = (*n)->pos;
        nlohmann::json point;
        point["index"] = (*n)->index;
        point["position"] = {pos.X, pos.Y, pos.Z};
        meshJson["points"].push_back(point);
    }
    
	// Edges represent connections between nodes and can be stacking fault edges. 
	// Facets represent triangular surfaces that belong to dislocation segments.
    meshJson["edges"] = nlohmann::json::array();
    for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n){
        for(int i = 0; i < (*n)->numEdges; i++){
            if(isWrappedEdge(&(*n)->edges[i]) == false) {
                json edge;
                edge["vertices"] = {(*n)->index, (*n)->edgeNeighbor(i)->index};
                
                // Calcular edge_count
                int count = 0;
                for(int c = 0; c < (*n)->numEdges; c++){
                    if((*n)->edgeNeighbor(c) == (*n)->edgeNeighbor(i)){
                        count++;
					}
                }
                edge["edge_count"] = count;
                edge["isSF"] = (*n)->edges[i].isSFEdge ? 1 : 0;
                
                meshJson["edges"].push_back(edge);
            }
        }
    }
    
    // Facets/Triangles
    meshJson["facets"] = nlohmann::json::array();
    for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
        if(isWrappedFacet(*f) == false) {
            nlohmann::json facet;
            facet["vertices"] = {
                (*f)->vertex(0)->index,
                (*f)->vertex(1)->index,
                (*f)->vertex(2)->index
            };
            
            // Segment
            if((*f)->circuit != NULL){
                facet["segment"] = (*f)->circuit->segment->index;
			}else{
                facet["segment"] = -1;
			}
            
            // Final segment
            if((*f)->circuit != NULL && ((*f)->circuit->isDangling == false || (*f)->testFlag(FACET_IS_PRIMARY_SEGMENT))){
                DislocationSegment* segment = (*f)->circuit->segment;
                while(segment->replacedWith != NULL){
                    segment = segment->replacedWith;
				}
                facet["final_segment"] = segment->index;
            }else{
                facet["final_segment"] = -1;
			}
            facet["is_primary_segment"] = (*f)->testFlag(FACET_IS_PRIMARY_SEGMENT) ? 1 : 0;
            facet["selection"] = (*f)->selection;
            
            meshJson["facets"].push_back(facet);
        }
    }
    
    // Add summary of cell data organized by type
    meshJson["summary"]["edge_count"] = json::array();
    meshJson["summary"]["segment"] = json::array();
    meshJson["summary"]["final_segment"] = json::array();
    meshJson["summary"]["is_primary_segment"] = json::array();
    meshJson["summary"]["selection"] = json::array();
    meshJson["summary"]["isSF"] = json::array();
    
    // fill summary arrays for edges
    for(const auto& edge : meshJson["edges"]){
        meshJson["summary"]["edge_count"].push_back(edge["edge_count"]);
        meshJson["summary"]["isSF"].push_back(edge["isSF"]);
    }
    
    // Populate summary arrays for facets
    for(const auto& facet : meshJson["facets"]){
        meshJson["summary"]["segment"].push_back(facet["segment"]);
        meshJson["summary"]["final_segment"].push_back(facet["final_segment"]);
        meshJson["summary"]["is_primary_segment"].push_back(facet["is_primary_segment"]);
        meshJson["summary"]["selection"].push_back(facet["selection"]);
    }

	return meshJson;
}

json DXAStackingFaults::getStackingFaults() const{
	json root;
	root["num_stacking_faults"] = stackingFaults.size();
	json stackingFaultsArr = json::array();
	for(const auto* sf : stackingFaults){
		json data = sf->getStackingFault();
		data["index"] = sf->index;
		data["is_invalid"] = sf->isInvalid;
        data["normal_vector"] = {sf->normalVector.X, sf->normalVector.Y, sf->normalVector.Z};
        data["center"] = {sf->center.X, sf->center.Y, sf->center.Z};
        data["base_point"] = {sf->basePoint.X, sf->basePoint.Y, sf->basePoint.Z};
        data["num_hcp_atoms"] = sf->numHCPAtoms;
        data["num_isf_atoms"] = sf->numISFAtoms;
        data["num_tb_atoms"] = sf->numTBAtoms;
        data["is_infinite"] = {sf->isInfinite[0], sf->isInfinite[1], sf->isInfinite[2]};
        data["is_invalid"] = sf->isInvalid;
        stackingFaultsArr.push_back(data);
	}
	root["data"] = stackingFaultsArr;
	return root;
}

json OutputMesh::getOutputMeshData(){
	json root;
	root["metadata"]["num_vertices"] = vertices.size();
	root["metadata"]["num_facets"] = facets.size();
	root["metadata"]["total_cells"] = facets.size();

	root["vertices"] = json::array();
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v){
		json vertex;
		vertex["index"] = (*v)->index;
		vertex["position"] = { (*v)->pos.X, (*v)->pos.Y, (*v)->pos.Z };
		vertex["normal"] = { (*v)->normal.X, (*v)->normal.Y, (*v)->normal.Z };
		root["vertices"].push_back(vertex);
	}

	root["facets"] = json::array();
    for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f){
		json facet;
		facet["vertices"] = {
			(*f)->edges[0]->vertex2->index,
            (*f)->edges[1]->vertex2->index,
            (*f)->edges[2]->vertex2->index
		};
		facet["entity"] = (*f)->entity;
        facet["disclination_barrier"] = (*f)->testFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER);
		root["facets"].push_back(facet);
	}

	root["point_data"]["normals"] = json::array();
    for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v){
		root["point_data"]["normals"].push_back({
			(*v)->normal.X, (*v)->normal.Y, (*v)->normal.Z
		});
	}

	root["cell"]["entity"] = json::array();
	root["cell"]["disclination_barrier"]= json::array();
    for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f){
		root["cell"]["entity"].push_back((*f)->entity);
		root["cell"]["dislocation_barrier"].push_back(
            (*f)->testFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER)
		);
	}

	return root;
}

json BurgersCircuit::getBurgersCircuit(){
	json root;

	root["num_edges"] = edgeCount;

	// Points
	root["points"] = json::array();
	MeshEdge* edge = firstEdge;
	int pointIndex = 0;

	do{
		Point3 vizpos = edge->node1->pos;
		if(edge->facet){
			Vector3 normal = CrossProduct(
                edge->facet->vertex(2)->pos - edge->facet->vertex(0)->pos, 
                edge->facet->vertex(1)->pos - edge->facet->vertex(0)->pos
            );
            vizpos += NormalizeSafely(normal) * 0.05;
		}
		if(edge->oppositeEdge->facet){
            Vector3 normal = CrossProduct(
                edge->oppositeEdge->facet->vertex(2)->pos - edge->oppositeEdge->facet->vertex(0)->pos, 
                edge->oppositeEdge->facet->vertex(1)->pos - edge->oppositeEdge->facet->vertex(0)->pos
            );
            vizpos += NormalizeSafely(normal) * 0.05;
        }

		json point;
		point["index"] = pointIndex;
        point["position"] = {vizpos.X, vizpos.Y, vizpos.Z};
        point["original_position"] = {edge->node1->pos.X, edge->node1->pos.Y, edge->node1->pos.Z};
        point["lattice_vector"] = {edge->latticeVector[0], edge->latticeVector[1], edge->latticeVector[2]};
		root["points"].push_back(point);
		edge = edge->nextEdge;
		pointIndex++;
	}while(edge != firstEdge);

	// Cell/edges connect consecutive points building a circuit
	root["edges"] = json::array();
	for(int i = 0; i < edgeCount; i++){
		json edge;
		// Connect with the next (circular)
        edge["vertices"] = {i, (i + 1) % edgeCount}; 
		edge["index"] = i;
		root["edges"].push_back(edge);
	}

	// cell data lattice vectors for edge
	root["cell"]["lattice_vectors"] = json::array();

	// this while can be replaced with the last one?
	edge = firstEdge;
	do{
        json latticeVector = {edge->latticeVector[0], edge->latticeVector[1], edge->latticeVector[2]};
        root["cell"]["lattice_vectors"].push_back(latticeVector);
        edge = edge->nextEdge;
	}while(edge != firstEdge);

	// calcule total vector burger (sum of all lattice vectors)
	Vector3 totalBurgers = { 0.0, 0.0, 0.0 };
	edge = firstEdge;
	do{
		totalBurgers.X += edge->latticeVector[0];
        totalBurgers.Y += edge->latticeVector[1];
        totalBurgers.Z += edge->latticeVector[2];
		edge = edge->nextEdge;
	}while(edge != firstEdge);
	
	root["circuit"]["burgers_vector"] = {
		totalBurgers.X,
		totalBurgers.Y,
		totalBurgers.Z
	};

	root["circuit"]["burgers_magnitude"] = sqrt(
		totalBurgers.X*totalBurgers.X + 
		totalBurgers.Y*totalBurgers.Y + 
		totalBurgers.Z*totalBurgers.Z
	);

	return root;
}

json StackingFaultContour::getStackingFaultContour() const{
	json root;
	root["num_edges"] = edges.size();
	root["num_points"] = edges.size() * 2;

	// Points, each edge contributes 2 points (node1 and node2)
	root["points"] = json::array();
	int pointIndex = 0;
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i){
		MeshEdge *edge = *i;
		// Point 1 (node1)
        json point1;
        point1["index"] = pointIndex++;
        point1["position"] = {
			edge->node1->pos.X, 
			edge->node1->pos.Y, 
			edge->node1->pos.Z
		};
        point1["tag"] = edge->node1->tag;
        root["points"].push_back(point1);
		// Point 2 (node2)
		json point2;
        point2["index"] = pointIndex++;
        point2["position"] = {
			edge->node2()->pos.X, 
			edge->node2()->pos.Y, 
			edge->node2()->pos.Z
		};
        point2["node_id"] = edge->node2()->tag;
        root["points"].push_back(point2);
	}
	// Cells/Edges, each edge is a line connecting 2 consecutive points
	root["edges"] = json::array();
	for(int i = 0; i < edges.size(); i++){
		json edgeCell;
		// Connect consecutive points on each edge
        edgeCell["vertices"] = {i * 2, i * 2 + 1}; 
        edgeCell["edge_index"] = i;
        root["edges"].push_back(edgeCell);
	}

	root["cell"]["edge_index"] = json::array();
	root["cell"]["facet_determinant"] = json::array();
	root["cell"]["node_index"] = json::array();
	root["cell"]["is_sf_edge"] = json::array();
	
	int edgeIndex = 0;
	// TODO: can use the last one for loop?
    for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i){
		MeshEdge* edge = *i;
		root["cell"]["edge_index"].push_back(edgeIndex);

		// Facet determinant calculation
		MeshFacet* facet1 = edge->facet;
		MeshFacet* facet2 = edge->oppositeEdge->facet;
		if(facet1 != NULL && facet2 != NULL){
            MeshEdge* node1edge = facet1->previousEdge(edge)->oppositeEdge;
            MeshEdge* node2edge = facet2->nextEdge(edge->oppositeEdge);
            MeshNode* node1 = node1edge->node2();
            MeshNode* node2 = node2edge->node2();

            FloatType facet_det = Matrix3(
                edge->latticeVector, 
                node1edge->latticeVector, 
                node2edge->latticeVector
            ).determinant();
            root["cell"]["facet_determinant"].push_back(facet_det);
		}else{
			root["cell"]["facet_determinant"].push_back(0.0);
		}

		// Node index (node1 tag)
		root["cell"]["node_Index"].push_back(edge->node1->tag);
		
		root["cell"]["is_sf_edge"].push_back(edge->isSFEdge);
		
		edgeIndex++;
	}

	int sfEdgeCount = 0;
	// TODO: can use the last one for loop?
    for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i){
		if((*i)->isSFEdge){
			sfEdgeCount++;
		}
	}
	root["contour"]["stacking_fault_edge_count"] = sfEdgeCount;
	root["contour"]["stacking_fault_ratio"] = (double)sfEdgeCount / edges.size();

	// Range of facet determinants (useful for analysis)
	// Well, it is possible to quantitatively characterize 
	// crystalline quality, detect defects, and validate the 
	// physical consistency of dislocations.
	vector<FloatType> facetDets;
	for(const auto &det : root["cell"]["facet_determinant"]){
		if(det != 0.0){
			facetDets.push_back(det);
		}
	}

	if(!facetDets.empty()){
		auto minmax = std::minmax_element(facetDets.begin(), facetDets.end());
		root["contour"]["facet_determinant_range"]["min"] = *minmax.first;
		root["contour"]["facet_determinant_range"]["max"] = *minmax.second;

		FloatType sum = std::accumulate(facetDets.begin(), facetDets.end(), 0.0);
		root["contour"]["facet_determinant_range"]["mean"] = sum / facetDets.size();
	}

	return root;
}

json StackingFault::getStackingFault() const{
	json root;
	root["num_contours"] = contours.size();

	size_t totalNumEdges = 0;
	size_t totalNumPoints = 0;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c){
        totalNumEdges += c->edges.size();
        totalNumPoints += c->edges.size() * 2;
    }
	root["total_edges"] = totalNumEdges;
	root["total_points"] = totalNumPoints;
	root["contours"] = json::array();
    for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c){
		int contourId = c - contours.begin();
		json contourData = c->getStackingFaultContour();
		contourData["contour_id"] = contourId;
		root["contours"].push_back(contourData);
	}

	root["consolidated"]["points"] = json::array();
	root["consolidated"]["edges"] = json::array();
    root["consolidated"]["cell"]["contour_id"] = json::array();
    root["consolidated"]["cell"]["edge_index_local"] = json::array();
    root["consolidated"]["cell"]["edge_index_global"] = json::array();
    
	int globalPointIndex = 0;
    int globalEdgeIndex = 0;
    
    for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c){
        int contourId = c - contours.begin();
        
        for(vector<MeshEdge*>::const_iterator i = c->edges.begin(); i != c->edges.end(); ++i){
            MeshEdge* edge = *i;
            
            // Points (2 per edge)
            // Point 1 (node1)
            json point1;
            point1["index"] = globalPointIndex++;
            point1["contour_id"] = contourId;
            
            if(edge->node1->outputVertex == NULL) {
                point1["position"] = {edge->node1->pos.X, edge->node1->pos.Y, edge->node1->pos.Z};
            } else {
                point1["position"] = {
                    edge->node1->outputVertex->pos.X,
                    edge->node1->outputVertex->pos.Y,
                    edge->node1->outputVertex->pos.Z
                };
            }
            point1["tag"] = edge->node1->tag;
            root["consolidated"]["points"].push_back(point1);
            
            // Point 2 (node2)
            json point2;
            point2["index"] = globalPointIndex++;
            point2["contour_id"] = contourId;
            
            if(edge->node2()->outputVertex == NULL) {
                point2["position"] = {edge->node2()->pos.X, edge->node2()->pos.Y, edge->node2()->pos.Z};
            } else {
                point2["position"] = {
                    edge->node2()->outputVertex->pos.X,
                    edge->node2()->outputVertex->pos.Y,
                    edge->node2()->outputVertex->pos.Z
                };
            }
            point2["tag"] = edge->node2()->tag;
            root["consolidated"]["points"].push_back(point2);
            
            // Edge
            json edgeCell;
            edgeCell["vertices"] = {globalEdgeIndex * 2, globalEdgeIndex * 2 + 1};
            edgeCell["contour_id"] = contourId;
            root["consolidated"]["edges"].push_back(edgeCell);
            
            // Cell data
            root["consolidated"]["cell"]["contour_id"].push_back(contourId);
            root["consolidated"]["cell"]["edge_index_local"].push_back(i - c->edges.begin());
            root["consolidated"]["cell"]["edge_index_global"].push_back(globalEdgeIndex);
            
            globalEdgeIndex++;
        }
    }

	root["summary"]["total_contours"] = contours.size();
    root["summary"]["total_edges"] = totalNumEdges;
    root["summary"]["total_points"] = totalNumPoints;
    
    int totalSfEdges = 0;
    vector<FloatType> allFacetDets;
    
    for(const auto& contour : root["contours"]){
        totalSfEdges += contour["contour"]["stacking_fault_edge_count"].get<int>();
        
        for(const auto& det : contour["cell"]["facet_determinant"]){
            if(det.get<FloatType>() != 0.0){
                allFacetDets.push_back(det.get<FloatType>());
            }
		}
    }
    
    root["summary"]["total_stacking_fault_edges"] = totalSfEdges;
    root["summary"]["overall_stacking_fault_ratio"] = (double)totalSfEdges / totalNumEdges;
    
    if(!allFacetDets.empty()) {
        auto minmax = std::minmax_element(allFacetDets.begin(), allFacetDets.end());
        root["summary"]["global_facet_determinant_range"]["min"] = *minmax.first;
        root["summary"]["global_facet_determinant_range"]["max"] = *minmax.second;
        
        FloatType sum = std::accumulate(allFacetDets.begin(), allFacetDets.end(), 0.0);
        root["summary"]["global_facet_determinant_range"]["mean"] = sum / allFacetDets.size();
    }
    
    return root;
}

// TODO: add mesh data info
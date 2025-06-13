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
        for (auto const& p : segment->line) {
            pts.push_back({{"x", p.X}, {"y", p.Y}, {"z", p.Z}});
        }
        auto bv = segment->burgersVector;
        auto bw = segment->burgersVectorWorld;
        double mag = std::sqrt(double(bv.X*bv.X + bv.Y*bv.Y + bv.Z*bv.Z));
        json s;
        s["id"] = segment->index;
        s["point_index_offset"] = idx_offset;
        s["num_points"] = pts.size();
        s["points"] = std::move(pts);
        s["length"] = segment->calculateLength();
        s["burgers_vector"] = {{"x", bv.X}, {"y", bv.Y}, {"z", bv.Z}};
        s["burgers_vector_world"] = {{"x", bw.X}, {"y", bw.Y}, {"z", bw.Z}};
        s["burgers_vector_magnitude"] = mag;
        s["fractional_burgers"] = burgersToFractionalString(bv);
        segs.push_back(std::move(s));
        idx_offset += segment->line.size();
    }
    root["segments"] = std::move(segs);

	return root;
}

void DXAClustering::writeAtomsDumpFile(ostream& stream){
	LOG_INFO() << "Dumping atoms to output file.";

	writeSimulationCellHeaderLAMMPS(stream);
	stream << "ITEM: NUMBER OF ATOMS";
	stream << inputAtoms.size();
	stream << "ITEM: ATOMS id x y z CNAAtomType Coordination RecursiveDepth IsISF IsTB";
	stream;
	for(vector<InputAtom>::const_iterator p = inputAtoms.begin(); p != inputAtoms.end(); ++p){
		stream        << p->tag;
		stream << " " << p->pos.X << " " << p->pos.Y << " " << p->pos.Z;
		stream << " " << p->cnaType;
		stream << " " << p->numNeighbors;
		stream << " " << p->recursiveDepth;
		stream << " " << p->testFlag(ATOM_ISF);
		stream << " " << p->testFlag(ATOM_TB);
		stream;
	}
	stream << flush;
}

json DXAInterfaceMesh::getInterfaceMeshData(){
    json meshJson;
    
    // Count uninvolved facets and edges
    size_t numFacets = 0;
    for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
        if(isWrappedFacet(*f) == false)
            numFacets++;
    }
    
    size_t numEdges = 0;
    for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
        for(int i = 0; i < (*n)->numEdges; i++) {
            if(isWrappedEdge(&(*n)->edges[i]) == false)
                numEdges++;
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
        point["coordinates"] = {pos.X, pos.Y, pos.Z};
        meshJson["points"].push_back(point);
    }
    
    // Edges
    meshJson["edges"] = nlohmann::json::array();
    for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n){
        for(int i = 0; i < (*n)->numEdges; i++){
            if(isWrappedEdge(&(*n)->edges[i]) == false) {
                nlohmann::json edge;
                edge["vertices"] = {(*n)->index, (*n)->edgeNeighbor(i)->index};
                
                // Calcular edge_count
                int count = 0;
                for(int c = 0; c < (*n)->numEdges; c++){
                    if((*n)->edgeNeighbor(c) == (*n)->edgeNeighbor(i))
                        count++;
                }
                edge["edge_count"] = count;
                edge["segment"] = 0;
                edge["final_segment"] = 0;
                edge["is_primary_segment"] = 0;
                edge["selection"] = 0;
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
            
            facet["edge_count"] = 0;
            
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
            facet["isSF"] = 0;
            
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
        meshJson["summary"]["segment"].push_back(edge["segment"]);
        meshJson["summary"]["final_segment"].push_back(edge["final_segment"]);
        meshJson["summary"]["is_primary_segment"].push_back(edge["is_primary_segment"]);
        meshJson["summary"]["selection"].push_back(edge["selection"]);
        meshJson["summary"]["isSF"].push_back(edge["isSF"]);
    }
    
    // Populate summary arrays for facets
    for(const auto& facet : meshJson["facets"]){
        meshJson["summary"]["edge_count"].push_back(facet["edge_count"]);
        meshJson["summary"]["segment"].push_back(facet["segment"]);
        meshJson["summary"]["final_segment"].push_back(facet["final_segment"]);
        meshJson["summary"]["is_primary_segment"].push_back(facet["is_primary_segment"]);
        meshJson["summary"]["selection"].push_back(facet["selection"]);
        meshJson["summary"]["isSF"].push_back(facet["isSF"]);
    }

	return meshJson;
}

void DXATracing::writeDislocationsVTKFile(ostream& stream) const{
	LOG_INFO() << "Writing dislocation lines to output file.";

	// Gather dislocation line points.
	size_t numSegmentPoints = 0;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		numSegmentPoints += (*segment)->line.size();
	}

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << numSegmentPoints << " float" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		for(deque<Point3>::const_iterator p = (*segment)->line.begin(); p != (*segment)->line.end(); ++p) {
			stream << p->X << " " << p->Y << " " << p->Z << endl;
		}
	}
	
	size_t numCells = segments.size();
	stream << "CELLS " << numCells << " " << (numSegmentPoints + segments.size()) << endl;
	size_t startIndex = 0;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		DISLOCATIONS_ASSERT((*segment)->line.empty() == false);
		stream << (*segment)->line.size();
		for(size_t i = 0; i < (*segment)->line.size(); i++)
			stream << " " << (i+startIndex);
		stream << endl;  // Fixed: was just 'stream;'
		startIndex += (*segment)->line.size();
	}

	stream << "CELL_TYPES " << numCells << endl;
	for(size_t i = 0; i < segments.size(); i++)
		stream << "4" << endl;	// Poly line

	stream << "CELL_DATA " << numCells << endl;

	stream << "VECTORS burgers_vector float" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->burgersVector.X << " " << (*segment)->burgersVector.Y << " " << (*segment)->burgersVector.Z << endl;
	
	stream << "VECTORS burgers_vector_world float" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->burgersVectorWorld.X << " " << (*segment)->burgersVectorWorld.Y << " " << (*segment)->burgersVectorWorld.Z << endl;

	// Add fractional Burgers vector representation as scalars for enhanced visualization
	stream << "SCALARS burgers_vector_magnitude float" << endl;
	stream << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		// Calculate magnitude for color mapping
		LatticeVector bv = (*segment)->burgersVector;
		double magnitude = sqrt(static_cast<double>(bv.X * bv.X + bv.Y * bv.Y + bv.Z * bv.Z));
		stream << magnitude << endl;
	}

	stream << "SCALARS segment_length float" << endl;
	stream << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->calculateLength() << endl;
	
	stream << "SCALARS segment_id int 1" << endl;
	stream << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->index << endl;

	// Add fractional Burgers vector information as comments for human readability
	stream << "# Fractional Burgers Vector Notation:" << endl;
	int segmentIndex = 0;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment, ++segmentIndex) {
		std::string fractionalStr = burgersToFractionalString((*segment)->burgersVector);
		stream << "# Segment " << segmentIndex << ": " << fractionalStr << endl;
	}
}

void DXAInterfaceMesh::writeOutputMeshFile(ostream& stream) const{
	LOG_INFO() << "Writing defect surface to output file.";

	outputMesh.writeToVTKFile(stream, "Defect surface");
}

void OutputMesh::writeToVTKFile(ostream& stream, const string& commentHeaderLine) const{
	stream << "# vtk DataFile Version 3.0";
	stream << "ASCII";
	stream << "DATASET UNSTRUCTURED_GRID";
	stream << "POINTS " << vertices.size() << " float";
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v)
		stream << (*v)->pos.X << " " << (*v)->pos.Y << " " << (*v)->pos.Z;
	stream << endl << "CELLS " << facets.size() << " " << (facets.size()*4);
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << "3";
		for(int i=0; i<3; i++)
			stream << " " << (*f)->edges[i]->vertex2->index;
		stream;
	}
	stream << endl << "CELL_TYPES " << facets.size();
	for(size_t i = 0; i < facets.size(); i++)
		stream << "5";	// Triangle

	stream << "POINT_DATA " << vertices.size();
	stream << "NORMALS point_normals float";
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
		stream << (*v)->normal.X << " " << (*v)->normal.Y << " " << (*v)->normal.Z;
	}

	stream << endl << "CELL_DATA " << facets.size();

	stream << endl << "SCALARS entity int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << (*f)->entity;
	}

	stream << endl << "SCALARS disclination_barrier int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << (*f)->testFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER);
	}
}

void BurgersCircuit::writeToFile(ostream& stream){
	stream << "# vtk DataFile Version 3.0";
	stream << "# Burgers circuit";
	stream << "ASCII";
	stream << "DATASET UNSTRUCTURED_GRID";
	stream << "POINTS " << edgeCount << " float";
	MeshEdge* edge = firstEdge;
	do {
		Point3 vizpos = edge->node1->pos;
		if(edge->facet) {
			Vector3 normal = CrossProduct(edge->facet->vertex(2)->pos - edge->facet->vertex(0)->pos, edge->facet->vertex(1)->pos - edge->facet->vertex(0)->pos);
			vizpos += NormalizeSafely(normal) * 0.05;
		}
		if(edge->oppositeEdge->facet) {
			Vector3 normal = CrossProduct(edge->oppositeEdge->facet->vertex(2)->pos - edge->oppositeEdge->facet->vertex(0)->pos, edge->oppositeEdge->facet->vertex(1)->pos - edge->oppositeEdge->facet->vertex(0)->pos);
			vizpos += NormalizeSafely(normal) * 0.05;
		}
		stream << vizpos.X << " " << vizpos.Y << " " << vizpos.Z;
		edge = edge->nextEdge;
	}
	while(edge != firstEdge);
	stream << endl << "CELLS " << (edgeCount) << " " << (edgeCount*3);
	for(int i=0; i<edgeCount; i++)
		stream << "2 " << i << " " << ((i+1)%edgeCount);
	stream;
	stream << "CELL_TYPES " << edgeCount;
	for(int i=0; i<edgeCount; i++)
		stream << "3";

	stream << endl << "CELL_DATA " << (edgeCount);

	stream << endl << "VECTORS lattice_vector float";
	edge = firstEdge;
	do {
		for(int c = 0; c < 3; c++)
			stream << edge->latticeVector[c] << " ";
		stream;
		edge = edge->nextEdge;
	}
	while(edge != firstEdge);
}

void StackingFaultContour::writeToFile(ostream& stream) const{
	stream << "# vtk DataFile Version 3.0";
	stream << "# Stacking fault contour";
	stream << "ASCII";
	stream << "DATASET UNSTRUCTURED_GRID";
	stream << "POINTS " << (edges.size()*2) << " float";
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i) {
		MeshEdge* edge = *i;
		stream << edge->node1->pos.X << " " << edge->node1->pos.Y << " " << edge->node1->pos.Z;
		stream << edge->node2()->pos.X << " " << edge->node2()->pos.Y << " " << edge->node2()->pos.Z;
	}
	stream << endl << "CELLS " << edges.size() << " " << (edges.size()*3);
	for(int i=0; i<edges.size(); i++)
		stream << "2 " << (i*2) << " " << (i*2+1);
	stream;
	stream << "CELL_TYPES " << edges.size();
	for(int i=0; i<edges.size(); i++)
		stream << "3 ";

	stream << endl << "CELL_DATA " << edges.size();

	stream << endl << "SCALARS edge_index int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(int i=0; i<edges.size(); i++)
		stream << i;

	stream << endl << "SCALARS facet_det float 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i) {
		MeshEdge* edge = *i;
		MeshFacet* facet1 = edge->facet;
		MeshFacet* facet2 = edge->oppositeEdge->facet;
		if(facet1 != NULL && facet2 != NULL) {
			MeshEdge* node1edge = facet1->previousEdge(edge)->oppositeEdge;
			MeshEdge* node2edge = facet2->nextEdge(edge->oppositeEdge);
			MeshNode* node1 = node1edge->node2();
			MeshNode* node2 = node2edge->node2();
			FloatType facet_det = Matrix3(edge->latticeVector, node1edge->latticeVector, node2edge->latticeVector).determinant();
			stream << facet_det;
		}
		else stream << "0";
	}

	stream << endl << "SCALARS node_index int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i)
		stream << (*i)->node1->tag;

	stream << endl << "SCALARS isSFEdge int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i)
		stream << (*i)->isSFEdge;
}

void StackingFault::writeToFile(ostream& stream) const{
	size_t numEdges = 0;
	size_t numPoints = 0;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		numEdges += c->edges.size();
		numPoints += c->edges.size() * 2;
	}

	stream << "# vtk DataFile Version 3.0";
	stream << "# Stacking fault";
	stream << "ASCII";
	stream << "DATASET UNSTRUCTURED_GRID";
	stream << "POINTS " << numPoints << " float";
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(vector<MeshEdge*>::const_iterator i = c->edges.begin(); i != c->edges.end(); ++i) {
			MeshEdge* edge = *i;
			if(edge->node1->outputVertex == NULL)
				stream << edge->node1->pos.X << " " << edge->node1->pos.Y << " " << edge->node1->pos.Z;
			else
				stream << edge->node1->outputVertex->pos.X << " " << edge->node1->outputVertex->pos.Y << " " << edge->node1->outputVertex->pos.Z;
			if(edge->node2()->outputVertex == NULL)
				stream << edge->node2()->pos.X << " " << edge->node2()->pos.Y << " " << edge->node2()->pos.Z;
			else
				stream << edge->node2()->outputVertex->pos.X << " " << edge->node2()->outputVertex->pos.Y << " " << edge->node2()->outputVertex->pos.Z;
		}
	}
	stream << endl << "CELLS " << numEdges << " " << (numEdges*3);
	for(int i=0; i<numEdges; i++)
		stream << "2 " << (i*2) << " " << (i*2+1);
	stream;
	stream << "CELL_TYPES " << numEdges;
	for(int i=0; i<numEdges; i++)
		stream << "3";

	stream << endl << "CELL_DATA " << numEdges;

	stream << endl << "SCALARS contour int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(int i=0; i<c->edges.size(); i++)
			stream << (c-contours.begin());
	}

	stream << endl << "SCALARS edge_index int 1";
	stream << endl << "LOOKUP_TABLE default";
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(int i=0; i<c->edges.size(); i++)
			stream << i;	}
}

void MeshEdge::writeToFile(ostream& stream){
	stream << "# vtk DataFile Version 3.0";
	stream << "# Mesh edge";
	stream << "ASCII";
	stream << "DATASET UNSTRUCTURED_GRID";
	stream << "POINTS 2 float";
	stream << node1->pos.X << " " << node1->pos.Y << " " << node1->pos.Z;
	stream << node2()->pos.X << " " << node2()->pos.Y << " " << node2()->pos.Z;
	stream << endl << "CELLS 1 3";
	stream << endl << "2 0 1";
	stream;	stream << "CELL_TYPES 1";
	stream << "3 ";
}

#include "core/Clustering.hpp"
#include "core/InterfaceMesh.hpp"
#include "core/DislocationTracing.hpp"
#include "core/StackingFaults.hpp"
#include "utils/Burgers.hpp"
#include <sstream>

/******************************************************************************
* Dumps the input atoms to the given stream.
******************************************************************************/
void DXAClustering::writeAtomsDumpFile(ostream& stream)
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Dumping atoms to output file." << endl;
#endif

	writeSimulationCellHeaderLAMMPS(stream);
	stream << "ITEM: NUMBER OF ATOMS" << endl;
	stream << inputAtoms.size() << endl;
	stream << "ITEM: ATOMS id x y z CNAAtomType Coordination RecursiveDepth IsISF IsTB";
	stream << endl;
	for(vector<InputAtom>::const_iterator p = inputAtoms.begin(); p != inputAtoms.end(); ++p) {
		stream        << p->tag;
		stream << " " << p->pos.X << " " << p->pos.Y << " " << p->pos.Z;
		stream << " " << p->cnaType;
		stream << " " << p->numNeighbors;
		stream << " " << p->recursiveDepth;
		stream << " " << p->testFlag(ATOM_ISF);
		stream << " " << p->testFlag(ATOM_TB);
		stream << endl;
	}
	stream << flush;
}

/******************************************************************************
* Dumps the interface mesh to the given stream.
******************************************************************************/
void DXAInterfaceMesh::writeInterfaceMeshFile(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing interface mesh to output file." << endl;
#endif

	size_t numFacets = 0;
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		if(isWrappedFacet(*f) == false)
			numFacets++;
	}
	size_t numFacetVertices = numFacets*3;

	size_t numEdges = 0;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if(isWrappedEdge(&(*n)->edges[i]) == false)
				numEdges++;
		}
	}


	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Interface mesh" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << nodes.size() << " float" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		const Point3& pos = (*n)->pos;
		stream << pos.X << " " << pos.Y << " " << pos.Z << endl;
	}
	stream << endl << "CELLS " << (numEdges + numFacets) << " " << (numEdges*3 + numFacets + numFacetVertices) << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if(isWrappedEdge(&(*n)->edges[i]) == false)
				stream << "2 " << (*n)->index << " " << (*n)->edgeNeighbor(i)->index << endl;
		}
	}
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		if(isWrappedFacet(*f) == false) {
			stream << "3";
			for(int i=0; i<3; i++)
				stream << " " << (*f)->vertex(i)->index;
			stream << endl;
		}
	}

	stream << endl << "CELL_TYPES " << (numEdges + numFacets) << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "3" << endl;
	for(size_t i = 0; i < numFacets; i++)
		stream << "5" << endl;	// Triangle

	stream << endl << "CELL_DATA " << (numEdges + numFacets) << endl;

	stream << endl << "SCALARS edge_count int 1" << endl;
	stream << "LOOKUP_TABLE default" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if(isWrappedEdge(&(*n)->edges[i]) == false) {
				int count = 0;
				for(int c = 0; c < (*n)->numEdges; c++)
					if((*n)->edgeNeighbor(c) == (*n)->edgeNeighbor(i))
						count++;
				stream << count << endl;
			}
		}
	}
	for(size_t i = 0; i < numFacets; i++)
		stream << "0" << endl;

	/*
	stream << endl << "VECTORS lattice_vector float" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if(isWrappedEdge(&(*n)->edges[i]) == false) {
				for(int c = 0; c < 3; c++)
					stream << (*n)->edges[i].latticeVector[c] << " ";
				stream << endl;
			}
		}
	}
	for(size_t i = 0; i < numFacets; i++)
		stream << "0 0 0" << endl;
		*/

	stream << endl << "SCALARS segment int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "0" << endl;
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		if(isWrappedFacet(*f) == false) {
			if((*f)->circuit != NULL)
				stream << (*f)->circuit->segment->index << endl;
			else
				stream << "-1" << endl;
		}
	}

	stream << endl << "SCALARS final_segment int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "0" << endl;
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		if(isWrappedFacet(*f) == false) {
			if((*f)->circuit != NULL && ((*f)->circuit->isDangling == false || (*f)->testFlag(FACET_IS_PRIMARY_SEGMENT))) {
				DislocationSegment* segment = (*f)->circuit->segment;
				while(segment->replacedWith != NULL) segment = segment->replacedWith;
				stream << segment->index << endl;
			}
			else
				stream << "-1" << endl;
		}
	}

	stream << endl << "SCALARS is_primary_segment int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "0" << endl;
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f)
		if(isWrappedFacet(*f) == false)
			stream << (*f)->testFlag(FACET_IS_PRIMARY_SEGMENT) << endl;

	stream << endl << "SCALARS selection int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "0" << endl;
	for(vector<MeshFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f)
		if(isWrappedFacet(*f) == false)
			stream << (*f)->selection << endl;

	stream << endl << "SCALARS isSF int 1" << endl;
	stream << "LOOKUP_TABLE default" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].isSFEdge)
				stream << "1" << endl;
			else
				stream << "0" << endl;
		}
	}
	for(size_t i = 0; i < numFacets; i++)
		stream << "0" << endl;
}

/******************************************************************************
* Writes the extracted dislocation segments and defect surfaces to the given stream.
******************************************************************************/
void DXATracing::writeDislocationsVTKFile(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing dislocation lines to output file." << endl;
#endif

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
	stream << endl << "CELLS " << numCells << " " << (numSegmentPoints + segments.size()) << endl;
	size_t startIndex = 0;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		DISLOCATIONS_ASSERT((*segment)->line.empty() == false);
		stream << (*segment)->line.size();
		for(size_t i = 0; i < (*segment)->line.size(); i++)
			stream << " " << (i+startIndex);
		stream << endl;
		startIndex += (*segment)->line.size();
	}

	stream << endl << "CELL_TYPES " << numCells << endl;
	for(size_t i = 0; i < segments.size(); i++)
		stream << "4" << endl;	// Poly line

	stream << endl << "CELL_DATA " << numCells << endl;

	stream << endl << "VECTORS burgers_vector float" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->burgersVector.X << " " << (*segment)->burgersVector.Y << " " << (*segment)->burgersVector.Z << endl;	stream << endl << "VECTORS burgers_vector_world float" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->burgersVectorWorld.X << " " << (*segment)->burgersVectorWorld.Y << " " << (*segment)->burgersVectorWorld.Z << endl;

	// Add fractional Burgers vector representation as scalars for enhanced visualization
	stream << endl << "SCALARS burgers_vector_magnitude float" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment) {
		// Calculate magnitude for color mapping
		LatticeVector bv = (*segment)->burgersVector;
		double magnitude = sqrt(static_cast<double>(bv.X * bv.X + bv.Y * bv.Y + bv.Z * bv.Z));
		stream << magnitude << endl;
	}

	stream << endl << "SCALARS segment_length float" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->calculateLength() << endl;
	stream << endl << "SCALARS segment_id int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment)
		stream << (*segment)->index << endl;

	// Add fractional Burgers vector information as comments for human readability
	stream << endl << "# Fractional Burgers Vector Notation:" << endl;
	int segmentIndex = 0;
	for(vector<DislocationSegment*>::const_iterator segment = segments.begin(); segment != segments.end(); ++segment, ++segmentIndex) {
		std::string fractionalStr = burgersToFractionalString((*segment)->burgersVector);
		stream << "# Segment " << segmentIndex << ": " << fractionalStr << endl;
	}
}

/******************************************************************************
* Writes the simulation cell geometry to a visualization file.
******************************************************************************/
void AnalysisEnvironment::writeSimulationCellFileVTK(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing simulation cell to output file." << endl;
#endif

	Point3 corners[8];
	corners[0] = simulationCellOrigin;
	corners[1] = simulationCellOrigin + simulationCell.column(0);
	corners[2] = simulationCellOrigin + simulationCell.column(0) + simulationCell.column(1);
	corners[3] = simulationCellOrigin + simulationCell.column(1);
	corners[4] = simulationCellOrigin + simulationCell.column(2);
	corners[5] = simulationCellOrigin + simulationCell.column(0) + simulationCell.column(2);
	corners[6] = simulationCellOrigin + simulationCell.column(0) + simulationCell.column(1) + simulationCell.column(2);
	corners[7] = simulationCellOrigin + simulationCell.column(1) + simulationCell.column(2);

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS 8 float" << endl;
	for(int i=0; i<8; i++)
		stream << corners[i].X << " " << corners[i].Y << " " << corners[i].Z << endl;

	stream << endl << "CELLS 1 9" << endl;
	stream << "8 0 1 2 3 4 5 6 7" << endl;

	stream << endl << "CELL_TYPES 1" << endl;	stream << "12" << endl;  // Hexahedron
}

/******************************************************************************
* Writes the defect surfaces to the given stream.
******************************************************************************/
void DXAInterfaceMesh::writeOutputMeshFile(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing defect surface to output file." << endl;
#endif

	outputMesh.writeToVTKFile(stream, "Defect surface");
}

/******************************************************************************
* Writes the cap facets of the defect surfaces to the given stream.
******************************************************************************/
void DXAInterfaceMesh::writeOutputMeshCapFile(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing defect surface cap facets to output file." << endl;
#endif

	outputMeshCap.writeToVTKFile(stream, "Defect surface cap");
}

/******************************************************************************
* Writes the mesh to a VTK file.
******************************************************************************/
void OutputMesh::writeToVTKFile(ostream& stream, const string& commentHeaderLine) const
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << vertices.size() << " float" << endl;
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v)
		stream << (*v)->pos.X << " " << (*v)->pos.Y << " " << (*v)->pos.Z << endl;
	stream << endl << "CELLS " << facets.size() << " " << (facets.size()*4) << endl;
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << "3";
		for(int i=0; i<3; i++)
			stream << " " << (*f)->edges[i]->vertex2->index;
		stream << endl;
	}
	stream << endl << "CELL_TYPES " << facets.size() << endl;
	for(size_t i = 0; i < facets.size(); i++)
		stream << "5" << endl;	// Triangle

	stream << "POINT_DATA " << vertices.size() << endl;
	stream << "NORMALS point_normals float" << endl;
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
		stream << (*v)->normal.X << " " << (*v)->normal.Y << " " << (*v)->normal.Z << endl;
	}

	stream << endl << "CELL_DATA " << facets.size() << endl;

	stream << endl << "SCALARS entity int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << (*f)->entity << endl;
	}

	stream << endl << "SCALARS disclination_barrier int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		stream << (*f)->testFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER) << endl;
	}
}

/******************************************************************************
* Dumps the open edges of the interface mesh to a file.
******************************************************************************/
void DXAInterfaceMesh::writeOpenMeshEdges(ostream& stream, bool skipDeadEdges) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Dumping open mesh edges to output file." << endl;
#endif

	size_t numEdges = 0;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++)
			if((*n)->edges[i].facet == NULL) {
				if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false)
					numEdges++;
			}
	}

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Interface mesh" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << nodes.size() << " float" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		const Point3& pos = (*n)->pos;
		stream << pos.X << " " << pos.Y << " " << pos.Z << endl;
	}
	stream << endl << "CELLS " << numEdges << " " << numEdges*3 << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].facet == NULL) {
				if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false)
					stream << "2 " << (*n)->index << " " << (*n)->edgeNeighbor(i)->index << endl;
			}
		}
	}

	stream << endl << "CELL_TYPES " << numEdges << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "3" << endl;

	stream << endl << "CELL_DATA " << numEdges << endl;

	stream << endl << "VECTORS edge_vector float" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].facet != NULL) continue;
			if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false) {
				Vector3 edgeVector = (*n)->edgeNeighbor(i)->pos - (*n)->pos;
				if(fabs(edgeVector.X) < FLOATTYPE_EPSILON) edgeVector.X = 0;
				if(fabs(edgeVector.Y) < FLOATTYPE_EPSILON) edgeVector.Y = 0;
				if(fabs(edgeVector.Z) < FLOATTYPE_EPSILON) edgeVector.Z = 0;
				stream << edgeVector.X << " " << edgeVector.Y << " " << edgeVector.Z << endl;
			}
		}
	}

	stream << endl << "VECTORS lattice_vector float" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].facet != NULL) continue;
			if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false) {
				Vector3 latticeVector = (*n)->edges[i].latticeVector;
				if(fabs(latticeVector.X) < FLOATTYPE_EPSILON) latticeVector.X = 0;
				if(fabs(latticeVector.Y) < FLOATTYPE_EPSILON) latticeVector.Y = 0;
				if(fabs(latticeVector.Z) < FLOATTYPE_EPSILON) latticeVector.Z = 0;
				stream << latticeVector.X << " " << latticeVector.Y << " " << latticeVector.Z << endl;
			}
		}
	}

	stream << endl << "SCALARS node1 int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].facet != NULL) continue;
			if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false)
				stream << (*n)->tag << endl;
		}
	}

	stream << endl << "SCALARS node2 int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<MeshNode*>::const_iterator n = nodes.begin(); n != nodes.end(); ++n) {
		for(int i = 0; i < (*n)->numEdges; i++) {
			if((*n)->edges[i].facet != NULL) continue;
			if((*n)->edges[i].oppositeEdge->facet != NULL || skipDeadEdges == false)
				stream << (*n)->edges[i].node2()->tag << endl;
		}
	}
}

/******************************************************************************
* Writes the stacking fault planes to a file.
******************************************************************************/
void DXAStackingFaults::writeStackingFaults(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing stacking faults to output file." << endl;
#endif

	stackingFaultOutputMesh.writeToVTKFile(stream, "Stacking faults");

	// Append the ISF information to the file.
	stream << endl << "SCALARS intrinsic_stacking_fault float" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<OutputFacet*>::const_iterator f = stackingFaultOutputMesh.getFacets().begin(); f != stackingFaultOutputMesh.getFacets().end(); ++f) {
		DISLOCATIONS_ASSERT((*f)->entity >= 0 && (*f)->entity < stackingFaults.size());
		StackingFault* sf = stackingFaults[(*f)->entity];
		DISLOCATIONS_ASSERT(sf->numHCPAtoms > 0);
		stream << ((FloatType)sf->numISFAtoms / (FloatType)sf->numHCPAtoms) << endl;
	}

	// Append the TB information to the file.
	stream << endl << "SCALARS twin_boundary float" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<OutputFacet*>::const_iterator f = stackingFaultOutputMesh.getFacets().begin(); f != stackingFaultOutputMesh.getFacets().end(); ++f) {
		DISLOCATIONS_ASSERT((*f)->entity >= 0 && (*f)->entity < stackingFaults.size());
		StackingFault* sf = stackingFaults[(*f)->entity];
		DISLOCATIONS_ASSERT(sf->numHCPAtoms > 0);
		stream << ((FloatType)sf->numTBAtoms / (FloatType)sf->numHCPAtoms) << endl;
	}
}

/******************************************************************************
* Writes the stacking fault contours to a file.
******************************************************************************/
void DXAStackingFaults::writeStackingFaultContours(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing stacking fault contours to output file." << endl;
#endif

	// Count contour edges.
	size_t numEdges = 0;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			numEdges += contour->edges.size();
		}
	}

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# HCP atom planes" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << (numEdges*2) << " float" << endl;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			for(vector<MeshEdge*>::const_iterator edge = contour->edges.begin(); edge != contour->edges.end(); ++edge) {
				stream << (*edge)->node1->pos.X << " "<< (*edge)->node1->pos.Y << " "<< (*edge)->node1->pos.Z << endl;
				stream << (*edge)->node2()->pos.X << " "<< (*edge)->node2()->pos.Y << " "<< (*edge)->node2()->pos.Z << endl;
			}
		}
	}
	stream << endl << "CELLS " << numEdges << " " << (numEdges*3) << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "2 " << (i*2) << " " << (i*2+1) << endl;

	stream << endl << "CELL_TYPES " << numEdges << endl;
	for(size_t i = 0; i < numEdges; i++)
		stream << "3" << endl;

	stream << endl << "CELL_DATA " << numEdges << endl;
	stream << endl << "SCALARS stacking_fault int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			for(vector<MeshEdge*>::const_iterator edge = contour->edges.begin(); edge != contour->edges.end(); ++edge) {
				stream << (*sf)->index << endl;
			}
		}
	}

	stream << endl << "SCALARS contour_position float 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			for(size_t e = 0; e < contour->edges.size(); e++)
				stream << (FloatType)e/contour->edges.size() << endl;
		}
	}
}

/******************************************************************************
* Writes the stacking fault contours to a file.
******************************************************************************/
void DXAStackingFaults::writeStackingFaultPolylines(ostream& stream) const
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Writing stacking fault polylines to output file." << endl;
#endif

	// Count contour edges.
	size_t numPoints = 0;
	size_t numContours = 0;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			numPoints += contour->polyline.size();
			numContours++;
		}
	}

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# HCP atom planes" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << numPoints << " float" << endl;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			for(vector<Point3>::const_iterator p = contour->polyline.begin(); p != contour->polyline.end(); ++p) {
				stream << p->X << " "<< p->Y << " "<< p->Z << endl;
			}
		}
	}
	stream << endl << "CELLS " << numContours << " " << (numPoints+numContours) << endl;
	size_t index = 0;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			stream << contour->polyline.size();
			for(size_t i = 0; i < contour->polyline.size(); i++) {
				stream << " " << index++;
				stream << endl;
			}
		}
	}

	stream << endl << "CELL_TYPES " << numContours << endl;
	for(size_t i = 0; i < numContours; i++)
		stream << "7" << endl;	// Polyline

	stream << endl << "CELL_DATA " << numContours << endl;
	stream << endl << "SCALARS stacking_fault int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<StackingFault*>::const_iterator sf = stackingFaults.begin(); sf != stackingFaults.end(); ++sf) {
		for(vector<StackingFaultContour>::const_iterator contour = (*sf)->contours.begin(); contour != (*sf)->contours.end(); ++contour) {
			stream << (*sf)->index << endl;
		}	}
}

/******************************************************************************
* Writes a Burgers circuit to a visualization file.
******************************************************************************/
void BurgersCircuit::writeToFile(ostream& stream)
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Burgers circuit" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << edgeCount << " float" << endl;
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
		stream << vizpos.X << " " << vizpos.Y << " " << vizpos.Z << endl;
		edge = edge->nextEdge;
	}
	while(edge != firstEdge);
	stream << endl << "CELLS " << (edgeCount) << " " << (edgeCount*3) << endl;
	for(int i=0; i<edgeCount; i++)
		stream << "2 " << i << " " << ((i+1)%edgeCount) << endl;
	stream << endl;
	stream << "CELL_TYPES " << edgeCount << endl;
	for(int i=0; i<edgeCount; i++)
		stream << "3" << endl;

	stream << endl << "CELL_DATA " << (edgeCount) << endl;

	stream << endl << "VECTORS lattice_vector float" << endl;
	edge = firstEdge;
	do {
		for(int c = 0; c < 3; c++)
			stream << edge->latticeVector[c] << " ";
		stream << endl;
		edge = edge->nextEdge;
	}
	while(edge != firstEdge);
}

/******************************************************************************
* Writes a Burgers circuit to a visualization file.
******************************************************************************/
void BurgersCircuit::writeCapToFile(ostream& stream)
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Burgers circuit" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << primarySegmentCap.size() << " float" << endl;
	for(vector<MeshEdge*>::const_iterator i1 = primarySegmentCap.begin(); i1 != primarySegmentCap.end(); ++i1) {
		MeshEdge* edge = *i1;
		Point3 vizpos = edge->node1->pos;
		if(edge->facet) {
			Vector3 normal = CrossProduct(edge->facet->vertex(2)->pos - edge->facet->vertex(0)->pos, edge->facet->vertex(1)->pos - edge->facet->vertex(0)->pos);
			vizpos += NormalizeSafely(normal) * 0.05;
		}
		if(edge->oppositeEdge->facet) {
			Vector3 normal = CrossProduct(edge->oppositeEdge->facet->vertex(2)->pos - edge->oppositeEdge->facet->vertex(0)->pos, edge->oppositeEdge->facet->vertex(1)->pos - edge->oppositeEdge->facet->vertex(0)->pos);
			vizpos += NormalizeSafely(normal) * 0.05;
		}
		stream << vizpos.X << " " << vizpos.Y << " " << vizpos.Z << endl;
	}
	stream << endl << "CELLS " << (primarySegmentCap.size()) << " " << (primarySegmentCap.size()*3) << endl;
	for(int i=0; i<primarySegmentCap.size(); i++)
		stream << "2 " << i << " " << ((i+1)%primarySegmentCap.size()) << endl;
	stream << endl;
	stream << "CELL_TYPES " << primarySegmentCap.size() << endl;
	for(int i=0; i<primarySegmentCap.size(); i++)
	stream << "3" << endl;
}

/******************************************************************************
* Writes a stacking fault contour to a visualization file.
******************************************************************************/
void StackingFaultContour::writeToFile(ostream& stream) const
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Stacking fault contour" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << (edges.size()*2) << " float" << endl;
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i) {
		MeshEdge* edge = *i;
		stream << edge->node1->pos.X << " " << edge->node1->pos.Y << " " << edge->node1->pos.Z << endl;
		stream << edge->node2()->pos.X << " " << edge->node2()->pos.Y << " " << edge->node2()->pos.Z << endl;
	}
	stream << endl << "CELLS " << edges.size() << " " << (edges.size()*3) << endl;
	for(int i=0; i<edges.size(); i++)
		stream << "2 " << (i*2) << " " << (i*2+1) << endl;
	stream << endl;
	stream << "CELL_TYPES " << edges.size() << endl;
	for(int i=0; i<edges.size(); i++)
		stream << "3 " << endl;

	stream << endl << "CELL_DATA " << edges.size() << endl;

	stream << endl << "SCALARS edge_index int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(int i=0; i<edges.size(); i++)
		stream << i << endl;

	stream << endl << "SCALARS facet_det float 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
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
			stream << facet_det << endl;
		}
		else stream << "0" << endl;
	}

	stream << endl << "SCALARS node_index int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i)
		stream << (*i)->node1->tag << endl;

	stream << endl << "SCALARS isSFEdge int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<MeshEdge*>::const_iterator i = edges.begin(); i != edges.end(); ++i)
		stream << (*i)->isSFEdge << endl;
}

/******************************************************************************
* Writes a stacking fault contour to a visualization file.
******************************************************************************/
void StackingFaultContour::writePolyline(ostream& stream) const
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Stacking fault contour" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << polyline.size() << " float" << endl;
	for(vector<Point3>::const_iterator i = polyline.begin(); i != polyline.end(); ++i) {
		stream << i->X << " " << i->Y << " " << i->Z << endl;
	}
	stream << endl << "CELLS " << 1 << " " << (polyline.size()+1) << endl;
	stream << polyline.size();
	for(int i=0; i<polyline.size(); i++)
		stream << " " << i << endl;
	stream << endl;
	stream << "CELL_TYPES " << 1 << endl;
	stream << "7" << endl;	// Polyline
}

/******************************************************************************
* Writes a stacking fault contour to a visualization file.
******************************************************************************/
void StackingFault::writeToFile(ostream& stream) const
{
	size_t numEdges = 0;
	size_t numPoints = 0;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		numEdges += c->edges.size();
		numPoints += c->edges.size() * 2;
	}

	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Stacking fault" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS " << numPoints << " float" << endl;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(vector<MeshEdge*>::const_iterator i = c->edges.begin(); i != c->edges.end(); ++i) {
			MeshEdge* edge = *i;
			if(edge->node1->outputVertex == NULL)
				stream << edge->node1->pos.X << " " << edge->node1->pos.Y << " " << edge->node1->pos.Z << endl;
			else
				stream << edge->node1->outputVertex->pos.X << " " << edge->node1->outputVertex->pos.Y << " " << edge->node1->outputVertex->pos.Z << endl;
			if(edge->node2()->outputVertex == NULL)
				stream << edge->node2()->pos.X << " " << edge->node2()->pos.Y << " " << edge->node2()->pos.Z << endl;
			else
				stream << edge->node2()->outputVertex->pos.X << " " << edge->node2()->outputVertex->pos.Y << " " << edge->node2()->outputVertex->pos.Z << endl;
		}
	}
	stream << endl << "CELLS " << numEdges << " " << (numEdges*3) << endl;
	for(int i=0; i<numEdges; i++)
		stream << "2 " << (i*2) << " " << (i*2+1) << endl;
	stream << endl;
	stream << "CELL_TYPES " << numEdges << endl;
	for(int i=0; i<numEdges; i++)
		stream << "3" << endl;

	stream << endl << "CELL_DATA " << numEdges << endl;

	stream << endl << "SCALARS contour int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(int i=0; i<c->edges.size(); i++)
			stream << (c-contours.begin()) << endl;
	}

	stream << endl << "SCALARS edge_index int 1" << endl;
	stream << endl << "LOOKUP_TABLE default" << endl;
	for(vector<StackingFaultContour>::const_iterator c = contours.begin(); c != contours.end(); ++c) {
		for(int i=0; i<c->edges.size(); i++)
			stream << i << endl;	}
}

/******************************************************************************
* Writes a single edge to a visualization file.
******************************************************************************/
void MeshEdge::writeToFile(ostream& stream)
{
	stream << "# vtk DataFile Version 3.0" << endl;
	stream << "# Mesh edge" << endl;
	stream << "ASCII" << endl;
	stream << "DATASET UNSTRUCTURED_GRID" << endl;
	stream << "POINTS 2 float" << endl;
	stream << node1->pos.X << " " << node1->pos.Y << " " << node1->pos.Z << endl;
	stream << node2()->pos.X << " " << node2()->pos.Y << " " << node2()->pos.Z << endl;
	stream << endl << "CELLS 1 3" << endl;
	stream << endl << "2 0 1" << endl;
	stream << endl;	stream << "CELL_TYPES 1" << endl;
	stream << "3 " << endl;
}

#include "core/InterfaceMesh.hpp"
#include "core/DislocationTracing.hpp"
#include "utils/Timer.hpp"

/******************************************************************************
* Generates the nodes and facets of the output mesh.
******************************************************************************/
void DXATracing::generateOutputMesh()
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	LOG_INFO() << "Generating output mesh.";
	Timer timer;
#endif

	// Gather defect surface facets.
	for(vector<MeshFacet*>::const_iterator facet = facets.begin(); facet != facets.end(); ++facet) {
		if((*facet)->circuit != NULL) {
			if((*facet)->testFlag(FACET_IS_PRIMARY_SEGMENT) == true || (*facet)->circuit->isDangling == false)
				continue;
		}

		OutputEdge* outputEdges[3];

		// Transfer vertices.
		bool isDisclinationBarrier = false;
		for(int v = 0; v < 3; v++) {
			MeshEdge* meshEdge = (*facet)->edges[2-v];
			MeshNode* node1 = meshEdge->node1;
			MeshNode* node2 = meshEdge->node2();

			if(node1->outputVertex == NULL)
				node1->outputVertex = outputMesh.createVertex(node1->pos);
			if(node2->outputVertex == NULL)
				node2->outputVertex = outputMesh.createVertex(node2->pos);
			if(meshEdge->outputEdge == NULL) {
				DISLOCATIONS_ASSERT(meshEdge->oppositeEdge != NULL);
				DISLOCATIONS_ASSERT(meshEdge->oppositeEdge->oppositeEdge == meshEdge);
				DISLOCATIONS_ASSERT(meshEdge->oppositeEdge->outputEdge == NULL);
				meshEdge->outputEdge = outputMesh.createEdge(node1->outputVertex, node2->outputVertex);
				meshEdge->oppositeEdge->outputEdge = meshEdge->outputEdge->oppositeEdge;
			}
			outputEdges[v] = meshEdge->oppositeEdge->outputEdge;

			if(node1->testFlag(ATOM_DISCLINATION_BORDER))
				isDisclinationBarrier = true;
		}

		// Create new output facet.
		OutputFacet* newfacet = outputMesh.createFacet(outputEdges);

		if(isDisclinationBarrier)
			newfacet->setFlag(OUTPUT_FACET_IS_DISCLINATION_BARRIER);
	}

	// Generate cap vertices and facets.
	for(vector<BurgersCircuit*>::const_iterator circuit_iter = danglingCircuits.begin(); circuit_iter != danglingCircuits.end(); ++circuit_iter) {
		BurgersCircuit* circuit = *circuit_iter;
		DISLOCATIONS_ASSERT(circuit->isDangling);
		DISLOCATIONS_ASSERT(circuit->primarySegmentCap.empty() == false);

		OutputVertex* capVertex;
		if(circuit->isForwardCircuit())
			capVertex = outputMesh.createVertex(circuit->segment->line.back());
		else
			capVertex = outputMesh.createVertex(circuit->segment->line.front());
		capVertex->setFlag(OUTPUT_VERTEX_IS_FIXED);

		MeshNode* firstNode = circuit->primarySegmentCap.front()->node1;
		if(firstNode->outputVertex == NULL)
			firstNode->outputVertex = outputMesh.createVertex(firstNode->pos);
		OutputEdge* firstEdge = outputMesh.createEdge(capVertex, firstNode->outputVertex);
		OutputEdge* facetEdges[3];
		facetEdges[0] = firstEdge;

		for(vector<MeshEdge*>::const_iterator e = circuit->primarySegmentCap.begin(); e != circuit->primarySegmentCap.end(); ++e) {
			MeshEdge* meshEdge = (*e);
			MeshNode* node1 = meshEdge->node1;
			MeshNode* node2 = meshEdge->node2();

			DISLOCATIONS_ASSERT(node1->outputVertex != NULL);
			if(node2->outputVertex == NULL)
				node2->outputVertex = outputMesh.createVertex(node2->pos);
			if(meshEdge->outputEdge == NULL) {
				DISLOCATIONS_ASSERT(meshEdge->oppositeEdge->outputEdge == NULL);
				meshEdge->outputEdge = outputMesh.createEdge(node1->outputVertex, node2->outputVertex);
				meshEdge->oppositeEdge->outputEdge = meshEdge->outputEdge->oppositeEdge;
			}
			DISLOCATIONS_ASSERT(meshEdge->outputEdge->facet == NULL);
			//if(facetEdges[0]->facet)
			//	LOG_INFO() << "circuit->primarySegmentCap: " << circuit->primarySegmentCap.size() << "  " << (e - circuit->primarySegmentCap.begin());
			DISLOCATIONS_ASSERT(facetEdges[0]->facet == NULL);

			// Create new output facet.
			facetEdges[1] = meshEdge->outputEdge;
			if(e != circuit->primarySegmentCap.end()-1)
				facetEdges[2] = outputMesh.createEdge(node2->outputVertex, capVertex);
			else
				facetEdges[2] = firstEdge->oppositeEdge;
			OutputFacet* facet = outputMesh.createFacet(facetEdges);
			facetEdges[0] = facetEdges[2]->oppositeEdge;

			facet->entity = 1;
		}
	}

#if DISLOCATION_TRACE_OUTPUT >= 2
	LOG_INFO() << "Output mesh time: " << timer.elapsedTime() << " sec.";
#endif
}

/******************************************************************************
* Smooths the output mesh for better visualization results.
******************************************************************************/
void DXAInterfaceMesh::smoothOutputSurface(int smoothingLevel)
{
	if(smoothingLevel > 0) {
#if DISLOCATION_TRACE_OUTPUT >= 1
		LOG_INFO() << "Smoothing output mesh.";
		Timer timer;
#endif

		outputMesh.smoothMesh(smoothingLevel, *this);

#if DISLOCATION_TRACE_OUTPUT >= 2
		LOG_INFO() << "Mesh smoothing time: " << timer.elapsedTime() << " sec.";
#endif
	}
}

/******************************************************************************
* Prepares the defect surface mesh for output.
******************************************************************************/
void DXAInterfaceMesh::finishOutputSurface(bool createCapSurface)
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	LOG_INFO() << "Wrapping output mesh at periodic boundaries.";
#endif
	outputMesh.calculateNormals(*this);
	if(createCapSurface)
		outputMesh.wrapMesh(*this, &outputMeshCap);
	else
		outputMesh.wrapMesh(*this);
}

/******************************************************************************
* Smooths the output mesh for better visualization results.
******************************************************************************/
void OutputMesh::smoothMesh(int smoothingLevel, const AnalysisEnvironment& cell)
{
	// This is the implementation of the mesh smoothing algorithm:
	//
	// Gabriel Taubin
	// A Signal Processing Approach To Fair Surface Design
	// In SIGGRAPH 95 Conference Proceedings, pages 351-358 (1995)
	//

	FloatType k_PB = 0.1;
	FloatType lambda = 0.5;
	FloatType mu = 1.0 / (k_PB - 1.0/lambda);
	const FloatType prefactors[2] = { lambda, mu };

	for(int iteration = 0; iteration < smoothingLevel; iteration++) {
		for(int pass = 0; pass <= 1; pass++) {
			smoothMesh(prefactors[pass], cell, false);
		}
	}
}

/******************************************************************************
* Smooths the output mesh for better visualization results.
******************************************************************************/
void OutputMesh::smoothMesh(FloatType prefactor, const AnalysisEnvironment& cell, bool projectToNormals)
{
	// Reset Laplacians
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
		(*v)->laplacian = NULL_VECTOR;
	}

	// Compute discrete Laplacian for each vertex.
#pragma omp parallel for
	for(int facetIndex = 0; facetIndex < facets.size(); facetIndex++) {
		OutputFacet* facet = facets[facetIndex];
		Vector3 delta1 = cell.wrapVector(facet->edges[0]->vertex2->pos - facet->edges[2]->vertex2->pos);
		Vector3 delta2 = cell.wrapVector(facet->edges[1]->vertex2->pos - facet->edges[0]->vertex2->pos);
		Vector3 delta3 = cell.wrapVector(facet->edges[2]->vertex2->pos - facet->edges[1]->vertex2->pos);
		facet->edges[2]->vertex2->laplacian += delta1;
		facet->edges[0]->vertex2->laplacian += delta2;
		facet->edges[1]->vertex2->laplacian += delta3;
		facet->edges[0]->vertex2->laplacian -= delta1;
		facet->edges[1]->vertex2->laplacian -= delta2;
		facet->edges[2]->vertex2->laplacian -= delta3;
	}

	// Do smoothing.
#pragma omp parallel for
	for(int vertexIndex = 0; vertexIndex < vertices.size(); vertexIndex++) {
		OutputVertex* vertex = vertices[vertexIndex];
		if(!vertex->testFlag(OUTPUT_VERTEX_IS_FIXED) && vertex->numFacets != 0) {
			Vector3 d = (prefactor / (vertex->numFacets * 2)) * vertex->laplacian;
			if(projectToNormals) d = vertex->normal * DotProduct(d, vertex->normal);
			vertex->pos += d;
		}
	}
}

/******************************************************************************
* Smooths the dislocation lines for better visualization results.
******************************************************************************/
void DXATracing::smoothDislocationSegments(int smoothingLevel, int coarseningLevel)
{
	if(smoothingLevel <= 0) return;

#if DISLOCATION_TRACE_OUTPUT >= 1
	LOG_INFO() << "Smoothing dislocation segments.";
	Timer timer;
#endif

	// Reduce resolution of the dislocation line segments.
	// Remove points from the line segments because usually we have too many of them.
	if(coarseningLevel > 0) {
#pragma omp parallel for
		for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {
			deque<Point3>& line = segments[segmentIndex]->line;
			DISLOCATIONS_ASSERT(line.size() >= 2);

			int counter = 0;
			for(deque<Point3>::iterator p = line.begin()+1; p != line.end()-1; ) {
				if(counter != coarseningLevel) {
					p = line.erase(p);
					counter++;
				}
				else {
					++p;
					counter = 0;
				}
			}
			DISLOCATIONS_ASSERT(line.size() >= 2);
		}
	}

	// This is the 2d implementation of the mesh smoothing algorithm:
	//
	// Gabriel Taubin
	// A Signal Processing Approach To Fair Surface Design
	// In SIGGRAPH 95 Conference Proceedings, pages 351-358 (1995)
	//

	FloatType k_PB = 0.1;
	FloatType lambda = 0.5;
	FloatType mu = 1.0 / (k_PB - 1.0/lambda);
	const FloatType prefactors[2] = { lambda, mu };

#pragma omp parallel for
	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {
		deque<Point3>& line = segments[segmentIndex]->line;
		DISLOCATIONS_ASSERT(line.size() >= 2);

		vector<Vector3> laplacians(line.size());
		for(int iteration = 0; iteration < smoothingLevel; iteration++) {

			for(int pass = 0; pass <= 1; pass++) {
				// Compute discrete Laplacian for each point.
				vector<Vector3>::iterator l = laplacians.begin();
				if(segments[segmentIndex]->isClosedLoop() == false) {
					*l++ = NULL_VECTOR;
					deque<Point3>::const_iterator p1 = line.begin();
					deque<Point3>::const_iterator p2 = p1 + 1;
					for(;;) {
						deque<Point3>::const_iterator p0 = p1;
						++p1;
						++p2;
						if(p2 == line.end()) {
							*l++ = NULL_VECTOR;
							break;
						}
						*l++ = ((*p0 - *p1) + (*p2 - *p1)) * 0.5;
					}
					DISLOCATIONS_ASSERT(l == laplacians.end());
				}
				else {
					DISLOCATIONS_ASSERT(line.size() >= 3);
					deque<Point3>::const_iterator p0 = line.end() - 2;
					deque<Point3>::const_iterator p1 = line.begin();
					deque<Point3>::const_iterator p2 = p1 + 1;
					deque<Point3>::const_iterator endIter = line.end() - 1;
					do {
						if(p1 == line.begin())
							*l++ = (wrapVector(*p0 - *p1) + (*p2 - *p1)) * 0.5;
						else if(p2 == line.begin())
							*l++ = (wrapVector(*p0 - *p1) + wrapVector(*p2 - *p1)) * 0.5;
						else
							*l++ = ((*p0 - *p1) + (*p2 - *p1)) * 0.5;
						++p0; ++p1; ++p2;
						if(p0 == endIter) p0 = line.begin();
						if(p2 == endIter) p2 = line.begin();
					}
					while(p1 != endIter);
					*l++ = laplacians.front();
					DISLOCATIONS_ASSERT(l == laplacians.end());
				}

				vector<Vector3>::const_iterator lc = laplacians.begin();
				for(deque<Point3>::iterator p = line.begin(); p != line.end(); ++p, ++lc) {
					*p += prefactors[pass] * (*lc);
				}
			}
		}
	}

}

/******************************************************************************
* Wraps the dislocation lines at periodic boundaries.
******************************************************************************/
void DXATracing::wrapDislocationSegments()
{
	if(!hasPeriodicBoundaries())
		return;	// Nothing to do.

#if DISLOCATION_TRACE_OUTPUT >= 1
	LOG_INFO() << "Wrapping dislocation segments.";
	Timer timer;
#endif

	size_t oldSegmentCount = segments.size();
	for(size_t segmentIndex = 0; segmentIndex < oldSegmentCount; segmentIndex++) {
		DislocationSegment* segment = segments[segmentIndex];
		deque<Point3>& line = segment->line;
		DISLOCATIONS_ASSERT(line.size() >= 2);

		deque<Point3>::const_iterator p1 = line.begin();
		Vector3 p1reduced = reciprocalSimulationCell * (*p1 - simulationCellOrigin);
		Vector3 p1reducedi(floor(p1reduced.X), floor(p1reduced.Y), floor(p1reduced.Z));

		Point3 p1wrapped = *p1 - simulationCell * p1reducedi;

		deque<Point3> outputLine;
		outputLine.push_back(p1wrapped);
		deque<Point3>* output1 = &outputLine;

		for(deque<Point3>::const_iterator p2 = p1 + 1; p2 != line.end(); ++p2) {
			Vector3 p2reduced = reciprocalSimulationCell * (*p2 - simulationCellOrigin);
			Vector3 p2reducedi(floor(p2reduced.X), floor(p2reduced.Y), floor(p2reduced.Z));
			Point3 p2wrapped = *p2 - simulationCell * p2reducedi;

			if(p2reducedi != p1reducedi) {
				DislocationSegment* newSegment = segmentPool.construct(segment->burgersVector, segment->burgersVectorWorld);
				newSegment->index = segment->index;
				segments.push_back(newSegment);
				deque<Point3>* output2 = &newSegment->line;
				if(p2reducedi.X == p1reducedi.X && p2reducedi.Y == p1reducedi.Y) {
					output1->push_back(p1wrapped - ((p1reduced.Z - max(p1reducedi.Z, p2reducedi.Z)) / (p2reduced.Z - p1reduced.Z)) * (*p2 - *p1));
					output2->push_back(p2wrapped - ((p2reduced.Z - max(p1reducedi.Z, p2reducedi.Z)) / (p2reduced.Z - p1reduced.Z)) * (*p2 - *p1));
				}
				else if(p2reducedi.Z == p1reducedi.Z && p2reducedi.Y == p1reducedi.Y) {
					output1->push_back(p1wrapped - ((p1reduced.X - max(p1reducedi.X, p2reducedi.X)) / (p2reduced.X - p1reduced.X)) * (*p2 - *p1));
					output2->push_back(p2wrapped - ((p2reduced.X - max(p1reducedi.X, p2reducedi.X)) / (p2reduced.X - p1reduced.X)) * (*p2 - *p1));
				}
				else if(p2reducedi.X == p1reducedi.X && p2reducedi.Z == p1reducedi.Z) {
					output1->push_back(p1wrapped - ((p1reduced.Y - max(p1reducedi.Y, p2reducedi.Y)) / (p2reduced.Y - p1reduced.Y)) * (*p2 - *p1));
					output2->push_back(p2wrapped - ((p2reduced.Y - max(p1reducedi.Y, p2reducedi.Y)) / (p2reduced.Y - p1reduced.Y)) * (*p2 - *p1));
				}
				output1 = output2;
			}
			output1->push_back(p2wrapped);

			p1 = p2;
			p1reduced = p2reduced;
			p1reducedi = p2reducedi;
			p1wrapped = p2wrapped;
		}
		segment->line = outputLine;
	}

	// Clean up, remove degenerate segments.
	for(vector<DislocationSegment*>::iterator segment = segments.begin(); segment != segments.end(); ) {
		if((*segment)->line.size() <= 1)
			segment = segments.erase(segment);
		else
			++segment;
	}

#if DISLOCATION_TRACE_OUTPUT >= 2
	LOG_INFO() << "Dislocation wrapping time: " << timer.elapsedTime() << " sec.";
#endif
}

enum OutCodes {
	X_PLUS  = (1<<0),
	X_MINUS = (1<<1),
	Y_PLUS  = (1<<2),
	Y_MINUS = (1<<3),
	Z_PLUS  = (1<<4),
	Z_MINUS = (1<<5)
};
inline unsigned int computeOutCode(const Vector3& p)
{
	unsigned int code = 0;
	if(p.X > 1.0) code |= X_PLUS;
	else if(p.X < 0.0) code |= X_MINUS;
	if(p.Y > 1.0) code |= Y_PLUS;
	else if(p.Y < 0.0) code |= Y_MINUS;
	if(p.Z > 1.0) code |= Z_PLUS;
	else if(p.Z < 0.0) code |= Z_MINUS;
	return code;
}

/******************************************************************************
* Clips the dislocation segments to the given sub-volume.
******************************************************************************/
void DXATracing::clipDislocationLines(const Point3& clipOrigin, const Matrix3& clipCell)
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	LOG_INFO() << "Clipping dislocation segments.";
#endif

	Matrix3 reciprocalClipCell = clipCell.inverse();

	size_t oldSegmentCount = segments.size();
	for(size_t segmentIndex = 0; segmentIndex < oldSegmentCount; segmentIndex++) {
		DislocationSegment* segment = segments[segmentIndex];
		deque<Point3>& line = segment->line;
		DISLOCATIONS_ASSERT(line.size() >= 2);

		deque<Point3>::const_iterator p1_in = line.begin();
		Vector3 p1 = reciprocalClipCell * (*p1_in - clipOrigin);

		deque<Point3> outputLine1;
		deque<Point3>* currentOutput = &outputLine1;

		for(deque<Point3>::const_iterator p2_in = p1_in + 1; p2_in != line.end(); ++p2_in) {
			Vector3 p2 = reciprocalClipCell * (*p2_in - clipOrigin);

			Vector3 point1 = p1;
			Vector3 point2 = p2;
			unsigned int outcode1 = computeOutCode(point1);
			unsigned int outcode2 = computeOutCode(point2);

			bool accept = false;
			unsigned int alreadyClipped = 0;
			for(int iteration = 0;; iteration++) {
				DISLOCATIONS_ASSERT(iteration < 30);
				if((outcode1 | outcode2) == 0) {
					accept = true;
					break;
				}
				else if(outcode1 & outcode2) {
					break;
				}
				else {
					unsigned int outcodeOut = outcode1 ? outcode1 : outcode2;
					Vector3 intersection;
					if(outcodeOut & X_MINUS) {
						intersection = point1 + (point2 - point1) * ((0.0 - point1.X) / (point2.X - point1.X));
						DISLOCATIONS_ASSERT(fabs(intersection.X) <= FLOATTYPE_EPSILON);
						intersection.X = 0.0;
						alreadyClipped |= X_MINUS;
					}
					else if(outcodeOut & X_PLUS) {
						intersection = point1 + (point2 - point1) * ((1.0 - point1.X) / (point2.X - point1.X));
						DISLOCATIONS_ASSERT(fabs(intersection.X - 1.0) <= FLOATTYPE_EPSILON);
						intersection.X = 1.0;
						alreadyClipped |= X_PLUS;
					}
					else if(outcodeOut & Y_MINUS) {
						intersection = point1 + (point2 - point1) * ((0.0 - point1.Y) / (point2.Y - point1.Y));
						DISLOCATIONS_ASSERT(fabs(intersection.Y) <= FLOATTYPE_EPSILON);
						intersection.Y = 0.0;
						alreadyClipped |= Y_MINUS;
					}
					else if(outcodeOut & Y_PLUS) {
						intersection = point1 + (point2 - point1) * ((1.0 - point1.Y) / (point2.Y - point1.Y));
						DISLOCATIONS_ASSERT(fabs(intersection.Y - 1.0) <= FLOATTYPE_EPSILON);
						intersection.Y = 1.0;
						alreadyClipped |= Y_PLUS;
					}
					else if(outcodeOut & Z_MINUS) {
						intersection = point1 + (point2 - point1) * ((0.0 - point1.Z) / (point2.Z - point1.Z));
						DISLOCATIONS_ASSERT(fabs(intersection.Z) <= FLOATTYPE_EPSILON);
						intersection.Z = 0.0;
						alreadyClipped |= Z_MINUS;
					}
					else if(outcodeOut & Z_PLUS) {
						intersection = point1 + (point2 - point1) * ((1.0 - point1.Z) / (point2.Z - point1.Z));
						DISLOCATIONS_ASSERT(fabs(intersection.Z - 1.0) <= FLOATTYPE_EPSILON);
						intersection.Z = 1.0;
						alreadyClipped |= Z_PLUS;
					}
					if(outcode1) {
						point1 = intersection;
						outcode1 = computeOutCode(point1)/* & (~alreadyClipped)*/;
					}
					else {
						point2 = intersection;
						outcode2 = computeOutCode(point2)/* & (~alreadyClipped)*/;
					}
				}
			}
			if(accept) {
				Point3 p1w = clipOrigin + clipCell * point1;
				if(currentOutput->empty()) currentOutput->push_back(p1w);
				else if(currentOutput->back() != p1w) {
					DislocationSegment* newSegment = segmentPool.construct(segment->burgersVector, segment->burgersVectorWorld);
					newSegment->index = segment->index;
					segments.push_back(newSegment);
					currentOutput = &newSegment->line;
					currentOutput->push_back(p1w);
				}
				currentOutput->push_back(clipOrigin + clipCell * point2);
			}
			p1_in = p2_in;
			p1 = p2;
		}
		segment->line = outputLine1;
	}

	// Clean up, remove degenerate segments.
	for(vector<DislocationSegment*>::iterator segment = segments.begin(); segment != segments.end(); ) {
		if((*segment)->line.size() <= 1)
			segment = segments.erase(segment);
		else
			++segment;
	}
}

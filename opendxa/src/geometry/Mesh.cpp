#include <opendxa/geometry/Mesh.hpp>
#include <GL/glu.h>

void OutputMesh::clear(){
	vertices.clear();
	vertexPool.clear();
	facets.clear();
	facetPool.clear();
	edgePool.clear();
}

OutputVertex* OutputMesh::createVertex(const Point3& pos, const Vector3& normal){
	OutputVertex* vertex = vertexPool.construct();
	vertex->pos = pos;
	vertex->flags = 0;
	vertex->index = vertices.size();
	vertex->numFacets = 0;
	vertex->normal = normal;
	vertex->edges = NULL;
	vertices.push_back(vertex);
	return vertex;
}

OutputEdge* OutputMesh::createEdge(OutputVertex* vertex1, OutputVertex* vertex2){
	OutputEdge* edge = edgePool.construct();
	OutputEdge* oppositeEdge = edgePool.construct();
	edge->oppositeEdge = oppositeEdge;
	oppositeEdge->oppositeEdge = edge;
	edge->vertex2 = vertex2;
	oppositeEdge->vertex2 = vertex1;
	edge->facet = oppositeEdge->facet = NULL;
	edge->nextEdge = vertex1->edges;
	vertex1->edges = edge;
	oppositeEdge->nextEdge = vertex2->edges;
	vertex2->edges = oppositeEdge;
	return edge;
}

OutputFacet* OutputMesh::createFacet(OutputEdge* edges[3], int entity){
	OutputFacet* facet = facetPool.construct();
	facets.push_back(facet);
	facet->flags = 0;
	facet->entity = entity;
	facet->edges[0] = edges[0];
	facet->edges[1] = edges[1];
	facet->edges[2] = edges[2];
	edges[0]->vertex2->numFacets++;
	edges[1]->vertex2->numFacets++;
	edges[2]->vertex2->numFacets++;
	DISLOCATIONS_ASSERT_GLOBAL(edges[0]->facet == NULL);
	DISLOCATIONS_ASSERT_GLOBAL(edges[1]->facet == NULL);
	DISLOCATIONS_ASSERT_GLOBAL(edges[2]->facet == NULL);
	edges[0]->facet = facet;
	edges[1]->facet = facet;
	edges[2]->facet = facet;
	return facet;
}

OutputFacet* OutputMesh::createFacetAndEdges(OutputVertex* vertices[3], int entity){
	OutputEdge* edges[3];
	for(int v = 0; v < 3; v++) {
		OutputVertex* v2 = vertices[(v+1)%3];
		OutputEdge* edge = vertices[v]->edges;
		while(edge != NULL) {
			if(edge->vertex2 == v2) break;
			edge = edge->nextEdge;
		}
		if(edge == NULL)
			edge = createEdge(vertices[v], v2);
		DISLOCATIONS_ASSERT_GLOBAL(edge->facet == NULL);
		edges[v] = edge;
	}
	return createFacet(edges, entity);
}

static const Vector3 cubeCorners[8] = {
		Vector3(0,0,0),
		Vector3(1,0,0),
		Vector3(0,1,0),
		Vector3(0,0,1),
		Vector3(1,1,0),
		Vector3(0,1,1),
		Vector3(1,0,1),
		Vector3(1,1,1),
};

void OutputMesh::wrapMesh(const AnalysisEnvironment& cell, OutputMesh* capMesh){
	if(cell.hasPeriodicBoundaries() == false) return;

	// Convert all positions into reduced coordinates.
#pragma omp parallel for
	for(int vindex = 0; vindex < vertices.size(); vindex++) {
		OutputVertex* vertex = vertices[vindex];
		vertex->pos = ORIGIN + (cell.getReciprocalSimulationCell() * (vertex->pos - cell.getSimulationCellOrigin()));
	}

	bool isInside[8];
	if(capMesh) {
		// Determine which cell corners are inside the defect region. Exploit periodic boundary conditions.
		isInside[0] = pointInPolyhedron(ORIGIN + cubeCorners[0], cell);
		if(cell.pbcFlags()[0]) isInside[1] = isInside[0];
		else isInside[1] = pointInPolyhedron(ORIGIN + cubeCorners[1], cell);
		if(cell.pbcFlags()[1]) {
			isInside[2] = isInside[0];
			isInside[4] = isInside[1];
		}
		else {
			isInside[2] = pointInPolyhedron(ORIGIN + cubeCorners[2], cell);
			if(cell.pbcFlags()[0]) isInside[4] = isInside[2];
			else isInside[4] = pointInPolyhedron(ORIGIN + cubeCorners[4], cell);
		}
		if(cell.pbcFlags()[2]) {
			isInside[3] = isInside[0];
			isInside[6] = isInside[1];
			isInside[7] = isInside[4];
			isInside[5] = isInside[2];
		}
		else {
			isInside[3] = pointInPolyhedron(ORIGIN + cubeCorners[3], cell);
			if(cell.pbcFlags()[0]) isInside[6] = isInside[3];
			else isInside[6] = pointInPolyhedron(ORIGIN + cubeCorners[6], cell);
			if(cell.pbcFlags()[1]) {
				isInside[5] = isInside[3];
				isInside[7] = isInside[6];
			}
			else {
				isInside[5] = pointInPolyhedron(ORIGIN + cubeCorners[5], cell);
				if(cell.pbcFlags()[0]) isInside[7] = isInside[5];
				else isInside[7] = pointInPolyhedron(ORIGIN + cubeCorners[7], cell);
			}
		}
	}

	// Create corner vertices.
	OutputVertex* cornerVertices[8];
	for(int c = 0; c < 8; c++) {
		if(capMesh == NULL || isInside[c]) {
			cornerVertices[c] = createVertex(ORIGIN + cubeCorners[c]);
			cornerVertices[c]->setClipVertex(0);
			cornerVertices[c]->setClipVertex(1);
			cornerVertices[c]->setClipVertex(2);
			cornerVertices[c]->setFlag(OUTPUT_VERTEX_IS_CORNER);
		}
		else {
			cornerVertices[c] = NULL;
		}
	}

	for(int dim = 0; dim < 3; dim++) {
		if(cell.pbcFlags()[dim] == false) continue;

		// Make sure all vertices are inside the box.
#pragma omp parallel for
		for(int vindex = 0; vindex < vertices.size(); vindex++) {
			FloatType& p = vertices[vindex]->pos[dim];
			while(p < 0.0) p += 1.0;
			while(p > 1.0) p -= 1.0;
		}

		// Clip facet edges.
		size_t oldVertexCount = vertices.size();
		for(size_t i = 0; i < oldVertexCount; i++) {
			OutputEdge* edge = vertices[i]->edges;
			while(edge) {
				splitEdge(edge, cell, dim);
				edge = edge->nextEdge;
			}
		}
	}

	if(capMesh != NULL)
		createCaps(cell, *capMesh, cornerVertices);
#pragma omp parallel for
	for(int vindex = 0; vindex < vertices.size(); vindex++) {
		OutputVertex* vertex = vertices[vindex];
		vertex->pos = cell.getSimulationCellOrigin() + (cell.getSimulationCell() * (vertex->pos - ORIGIN));
	}
}

void OutputMesh::splitEdge(OutputEdge* edge, const AnalysisEnvironment& cell, int dim){
	OutputVertex* vertex1 = edge->oppositeEdge->vertex2;
	OutputVertex* vertex2 = edge->vertex2;
	FloatType rv = vertex1->pos[dim];
	FloatType rvdelta = vertex2->pos[dim] - rv;
	if(fabs(rvdelta) <= 0.5) return;

	FloatType t;
	if(rvdelta > 0.0){
		rvdelta -= 1.0;
		DISLOCATIONS_ASSERT_GLOBAL(rvdelta <= 0.0);
		DISLOCATIONS_ASSERT_GLOBAL(rvdelta >= -0.5);
		if(rvdelta != 0)
			t = (-rv) / rvdelta;
		else
			t = 0;
	}else{
		rvdelta += 1.0;
		DISLOCATIONS_ASSERT_GLOBAL(rvdelta >= 0.0);
		DISLOCATIONS_ASSERT_GLOBAL(rvdelta <= 0.5);
		if(rvdelta != 0)
			t = (1.0f - rv) / rvdelta;
		else
			t = 0;
	}
	if(t < 0.0) t = 0.0;
	else if(t > 1.0) t = 1.0;
	Vector3 reducedDelta = cell.wrapReducedVector(vertex2->pos - vertex1->pos);
	OutputVertex* intersectionPoint1 = createVertex(vertex1->pos + t * reducedDelta);
	OutputVertex* intersectionPoint2 = createVertex(vertex2->pos - (1.0f - t) * reducedDelta);
	for(int d = 0; d < dim; d++) {
		if(vertex1->isClipVertex(d) && vertex2->isClipVertex(d)) {
			intersectionPoint1->setClipVertex(d);
			intersectionPoint2->setClipVertex(d);
		}
	}
	intersectionPoint1->setClipVertex(dim);
	intersectionPoint2->setClipVertex(dim);
	if(rvdelta > 0.0) {
		intersectionPoint1->pos[dim] = 1.0;
		intersectionPoint2->pos[dim] = 0.0;
	}
	else if(rvdelta < 0.0) {
		intersectionPoint1->pos[dim] = 0.0;
		intersectionPoint2->pos[dim] = 1.0;
	}

	intersectionPoint1->normal = intersectionPoint2->normal = NormalizeSafely(t * vertex2->normal + (1.0f - t) * vertex1->normal);

	OutputEdge* edge1 = edge;
	OutputEdge* edge1op = edgePool.construct();
	OutputEdge* edge2 = edgePool.construct();
	OutputEdge* edge2op = edge->oppositeEdge;

	edge1->oppositeEdge = edge1op;
	edge1op->oppositeEdge = edge1;
	edge2->oppositeEdge = edge2op;
	edge2op->oppositeEdge = edge2;

	edge1->vertex2 = intersectionPoint1;
	edge2->vertex2 = vertex2;
	edge1op->vertex2 = vertex1;
	edge2op->vertex2 = intersectionPoint2;

	intersectionPoint1->edges = edge1op;
	edge1op->nextEdge = NULL;
	edge1op->facet = NULL;

	intersectionPoint2->edges = edge2;
	edge2->nextEdge = NULL;
	edge2->facet = NULL;

	DISLOCATIONS_ASSERT_GLOBAL(fabs(vertex1->pos[dim] - intersectionPoint1->pos[dim]) <= 0.5);
	DISLOCATIONS_ASSERT_GLOBAL(fabs(vertex2->pos[dim] - intersectionPoint2->pos[dim]) <= 0.5);

	if(edge1->facet)
		splitFacet(edge1->facet, edge1, edge2, intersectionPoint1, intersectionPoint2, dim);
	if(edge2->oppositeEdge->facet)
		splitFacet(edge2->oppositeEdge->facet, edge2op, edge1op, intersectionPoint2, intersectionPoint1, dim);
}

void OutputMesh::splitFacet(OutputFacet* facet1, OutputEdge* edge1, OutputEdge* edge2, OutputVertex* intersectionPoint1, OutputVertex* intersectionPoint2, int dim){
	DISLOCATIONS_ASSERT_GLOBAL(facet1 != NULL);
	OutputEdge* firstEdge = facet1->edges[(facet1->edgeIndex(edge1) + 2) % 3];
	OutputEdge* thirdEdge = facet1->edges[(facet1->edgeIndex(edge1) + 1) % 3];
	OutputVertex* thirdVertex1 = firstEdge->oppositeEdge->vertex2;
	OutputVertex* thirdVertex2 = thirdEdge->vertex2;
	DISLOCATIONS_ASSERT_GLOBAL(thirdEdge->oppositeEdge->vertex2 == edge2->vertex2);
	DISLOCATIONS_ASSERT_GLOBAL(thirdVertex1->isClipVertex(dim) == thirdVertex2->isClipVertex(dim));

	OutputEdge* splitEdge = edgePool.construct();
	OutputEdge* splitEdgeOpp = edgePool.construct();

	if(thirdVertex1->isClipVertex(dim) == false) {
		DISLOCATIONS_ASSERT_GLOBAL(thirdVertex1 == thirdVertex2);
		splitEdge->oppositeEdge = splitEdgeOpp;
		splitEdgeOpp->oppositeEdge = splitEdge;
	}else{
		DISLOCATIONS_ASSERT_GLOBAL(thirdVertex1 != thirdVertex2);
		OutputEdge* capEdge = edgePool.construct();
		OutputEdge* capEdgeOpp = edgePool.construct();
		capEdge->facet = NULL;
		capEdgeOpp->facet = NULL;
		capEdge->vertex2 = thirdVertex2;
		capEdgeOpp->vertex2 = intersectionPoint1;
		capEdge->nextEdge = intersectionPoint2->edges;
		intersectionPoint2->edges = capEdge;
		capEdgeOpp->nextEdge = thirdVertex1->edges;
		thirdVertex1->edges = capEdgeOpp;
		DISLOCATIONS_ASSERT(fabs(thirdVertex1->pos[dim] - intersectionPoint1->pos[dim]) <= 0.5);
		DISLOCATIONS_ASSERT(fabs(thirdVertex2->pos[dim] - intersectionPoint2->pos[dim]) <= 0.5);
		splitEdge->oppositeEdge = capEdgeOpp;
		capEdgeOpp->oppositeEdge = splitEdge;
		splitEdgeOpp->oppositeEdge = capEdge;
		capEdge->oppositeEdge = splitEdgeOpp;
	}

	splitEdge->vertex2 = thirdVertex1;

	splitEdgeOpp->nextEdge = thirdVertex2->edges;
	thirdVertex2->edges = splitEdgeOpp;

	if(fabs(thirdVertex1->pos[dim] - intersectionPoint1->pos[dim]) <= 0.5) {
		splitEdge->nextEdge = intersectionPoint1->edges;
		intersectionPoint1->edges = splitEdge;
	}else{
		DISLOCATIONS_ASSERT(fabs(thirdVertex1->pos[dim] - intersectionPoint2->pos[dim]) <= 0.5);
		splitEdge->nextEdge = intersectionPoint2->edges;
		intersectionPoint2->edges = splitEdge;
	}

	if(fabs(thirdVertex2->pos[dim] - intersectionPoint1->pos[dim]) <= 0.5) {
		splitEdgeOpp->vertex2 = intersectionPoint1;
	}else{
		DISLOCATIONS_ASSERT(fabs(thirdVertex2->pos[dim] - intersectionPoint2->pos[dim]) <= 0.5);
		splitEdgeOpp->vertex2 = intersectionPoint2;
	}

	OutputFacet* facet2 = facetPool.construct();
	facets.push_back(facet2);
	facet2->entity = facet1->entity;
	facet2->flags = facet1->flags;
	facet2->edges[0] = edge2;
	facet2->edges[1] = thirdEdge;
	facet2->edges[2] = splitEdgeOpp;
	edge2->facet = facet2;
	thirdEdge->facet = facet2;
	splitEdgeOpp->facet = facet2;
	facet1->edges[facet1->edgeIndex(thirdEdge)] = splitEdge;
	splitEdge->facet = facet1;
}

class CapTessellator{
public:
	CapTessellator(OutputMesh& _mesh) : mesh(_mesh) {
		tess = gluNewTess();
		gluTessCallback(tess, GLU_TESS_ERROR_DATA, (GLvoid (*)())errorData);
		gluTessCallback(tess, GLU_TESS_BEGIN_DATA, (GLvoid (*)())beginData);
		gluTessCallback(tess, GLU_TESS_END_DATA, (GLvoid (*)())endData);
		gluTessCallback(tess, GLU_TESS_VERTEX_DATA, (GLvoid (*)())vertexData);
		gluTessCallback(tess, GLU_TESS_COMBINE_DATA, (GLvoid (*)())combineData);
	}

	~CapTessellator(){
		gluDeleteTess(tess);
	}

	void writeToFile(ostream& stream, const AnalysisEnvironment& cell) {
		size_t numPoints = 0;
		for(vector< vector<Point3> >::const_iterator n = contours.begin(); n != contours.end(); ++n)
			numPoints += n->size();

		stream << "# vtk DataFile Version 3.0";
		stream << "# Interface mesh";
		stream << "ASCII";
		stream << "DATASET UNSTRUCTURED_GRID";
		stream << "POINTS " << numPoints << " float";
		for(vector< vector<Point3> >::const_iterator n = contours.begin(); n != contours.end(); ++n) {
			for(vector<Point3>::const_iterator p = n->begin(); p != n->end(); ++p) {
				Point3 wp = cell.getSimulationCellOrigin() + (cell.getSimulationCell() * (*p - ORIGIN));
				stream << wp.X << " " << wp.Y << " " << wp.Z;
			}
		}
		stream << endl << "CELLS " << contours.size() << " " << (contours.size()+numPoints);
		size_t counter = 0;
		for(vector< vector<Point3> >::const_iterator n = contours.begin(); n != contours.end(); ++n) {
			stream << n->size();
			for(size_t i = 0; i < n->size(); i++)
				stream << " " << counter++;
			stream;
		}

		stream << endl << "CELL_TYPES " << contours.size();
		for(size_t i = 0; i < contours.size(); i++)
			stream << "7";
	}


	void beginPolygon(const Vector3& facetNormal, const Vector3& planeNormal) {
		this->facetNormal = facetNormal;
		this->planeNormal = planeNormal;
		gluTessNormal(tess, -planeNormal.X, -planeNormal.Y, -planeNormal.Z);
		gluTessBeginPolygon(tess, this);
	}

	void endPolygon() {
		gluTessEndPolygon(tess);
	}

	void beginContour() { gluTessBeginContour(tess); contours.resize(contours.size()+1); }
	void endContour() { gluTessEndContour(tess); }

	void vertex(const Point3& pos) {
		vertex(mesh.createVertex(pos, facetNormal));
	}

	void vertex(OutputVertex* outputVertex) {
		double vertexCoord[3];
		vertexCoord[0] = outputVertex->pos.X;
		vertexCoord[1] = outputVertex->pos.Y;
		vertexCoord[2] = outputVertex->pos.Z;
		gluTessVertex(tess, vertexCoord, outputVertex);

		contours.back().push_back(outputVertex->pos);
	}

	static void beginData(GLenum type, void* polygon_data) {
		CapTessellator* tessellator = (CapTessellator*)polygon_data;
		tessellator->primitiveType = type;
		tessellator->vertices.clear();
	}

	static void endData(void* polygon_data) {
		CapTessellator* tessellator = (CapTessellator*)polygon_data;

		if(tessellator->primitiveType == GL_TRIANGLE_FAN) {
			DISLOCATIONS_ASSERT_GLOBAL(tessellator->vertices.size() >= 4);
			OutputVertex* facetVertices[3];
			facetVertices[0] = tessellator->vertices[0];
			facetVertices[1] = tessellator->vertices[1];
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin() + 2; v != tessellator->vertices.end(); ++v) {
				facetVertices[2] = *v;
				tessellator->mesh.createFacetAndEdges(facetVertices);
				facetVertices[1] = facetVertices[2];
			}
		}
		else if(tessellator->primitiveType == GL_TRIANGLE_STRIP) {
			DISLOCATIONS_ASSERT_GLOBAL(tessellator->vertices.size() >= 3);
			OutputVertex* facetVertices[3];
			facetVertices[0] = tessellator->vertices[0];
			facetVertices[1] = tessellator->vertices[1];
			bool even = true;
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin() + 2; v != tessellator->vertices.end(); ++v) {
				facetVertices[2] = *v;
				tessellator->mesh.createFacetAndEdges(facetVertices);
				if(even)
					facetVertices[0] = facetVertices[2];
				else
					facetVertices[1] = facetVertices[2];
				even = !even;
			}
		}
		else if(tessellator->primitiveType == GL_TRIANGLES) {
			for(vector<OutputVertex*>::iterator v = tessellator->vertices.begin(); v != tessellator->vertices.end(); v += 3) {
				tessellator->mesh.createFacetAndEdges(&*v);
			}
		}
	}

	static void vertexData(void* vertex_data, void* polygon_data) {
		CapTessellator* tessellator = (CapTessellator*)polygon_data;
		tessellator->vertices.push_back((OutputVertex*)vertex_data);
	}

	static void combineData(GLdouble coords[3], void* vertex_data[4], GLfloat weight[4], void** outDatab, void* polygon_data) {
		CapTessellator* tessellator = (CapTessellator*)polygon_data;
		OutputVertex* outputVertex = tessellator->mesh.createVertex(Point3(coords[0], coords[1], coords[2]), tessellator->facetNormal);
		*outDatab = outputVertex;
	}

	static void errorData(GLenum errno, void* polygon_data) {
		if(errno == GLU_TESS_NEED_COMBINE_CALLBACK)
			cerr << "ERROR: Could not tessellate cap polygon. It contains overlapping contours.";
		else
			cerr << "ERROR: Could not tessellate cap polygon. GLU error code: " << errno;
		DISLOCATIONS_ASSERT_GLOBAL(false);
	}

private:
	GLUtesselator* tess;
	OutputMesh& mesh;
	GLenum primitiveType;
	Vector3 facetNormal;
	Vector3 planeNormal;
	vector<OutputVertex*> vertices;

	vector< vector<Point3> > contours;
};

void OutputMesh::createCaps(const AnalysisEnvironment& cell, OutputMesh& capMesh, OutputVertex* cornerVertices[8]){
	CapTessellator tessellator(capMesh);

	for(int dim1 = 0; dim1 < 3; dim1++) {
		int dim2, dim3;
		if(dim1 == 0) { dim2 = 2; dim3 = 1; }
		else if(dim1 == 1) { dim2 = 0; dim3 = 2; }
		else { dim2 = 1; dim3 = 0; }

		Vector3 planeNormal = unitVectors[dim1];
		Vector3 facetNormal = Normalize(CrossProduct(cell.getSimulationCell() * unitVectors[dim2], cell.getSimulationCell() * unitVectors[dim3]));

		size_t oldVertexCount = capMesh.vertices.size();
		size_t oldFacetCount = capMesh.facets.size();

		if(cell.pbcFlags()[dim1] == false) {
			OutputVertex* facetVertices[3];
			facetVertices[0] = capMesh.createVertex(ORIGIN, facetNormal);
			facetVertices[1] = capMesh.createVertex(ORIGIN + unitVectors[dim2] + unitVectors[dim3], facetNormal);
			facetVertices[2] = capMesh.createVertex(ORIGIN + unitVectors[dim3], facetNormal);
			capMesh.createFacetAndEdges(facetVertices);
			facetVertices[2] = facetVertices[1];
			facetVertices[1] = capMesh.createVertex(ORIGIN + unitVectors[dim2], facetNormal);
			capMesh.createFacetAndEdges(facetVertices);
		}
		else {
			// Find corner vertices and sort them according to their position on the third axis.
			map<FloatType, OutputVertex*> corners[2][2];
			for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
				OutputVertex* vertex = (*v);
				if(vertex->isClipVertex(dim1) && vertex->pos[dim1] == 0 && !vertex->testFlag(OUTPUT_VERTEX_IS_CORNER)) {
					vertex->setFlag(OUTPUT_VERTEX_VISITED);
					if(vertex->isClipVertex(dim2)) {
						DISLOCATIONS_ASSERT_GLOBAL(vertex->isClipVertex(dim3) == false);
						DISLOCATIONS_ASSERT_GLOBAL(vertex->pos[dim2] == 0.0 || vertex->pos[dim2] == 1.0);
						if(vertex->pos[dim2] == 0) {
							DISLOCATIONS_ASSERT_GLOBAL(corners[0][0].find(vertex->pos[dim3]) == corners[0][0].end());
							corners[0][0][vertex->pos[dim3]] = vertex;
						}
						else {
							DISLOCATIONS_ASSERT_GLOBAL(corners[0][1].find(vertex->pos[dim3]) == corners[0][1].end());
							corners[0][1][vertex->pos[dim3]] = vertex;
						}
					}
					else if(vertex->isClipVertex(dim3)) {
						DISLOCATIONS_ASSERT_GLOBAL(vertex->isClipVertex(dim2) == false);
						DISLOCATIONS_ASSERT_GLOBAL(vertex->pos[dim3] == 0.0 || vertex->pos[dim3] == 1.0);
						if(vertex->pos[dim3] == 0) {
							DISLOCATIONS_ASSERT_GLOBAL(corners[1][0].find(vertex->pos[dim2]) == corners[1][0].end());
							corners[1][0][vertex->pos[dim2]] = vertex;
						}
						else {
							DISLOCATIONS_ASSERT_GLOBAL(corners[1][1].find(vertex->pos[dim2]) == corners[1][1].end());
							corners[1][1][vertex->pos[dim2]] = vertex;
						}
					}
				}
			}

			OutputVertex* capCorners[4];
			if(dim1 == 0) {
				capCorners[0] = cornerVertices[2];
				capCorners[1] = cornerVertices[5];
				capCorners[2] = cornerVertices[3];
				capCorners[3] = cornerVertices[0];
			}
			else if(dim1 == 1) {
				capCorners[0] = cornerVertices[3];
				capCorners[1] = cornerVertices[6];
				capCorners[2] = cornerVertices[1];
				capCorners[3] = cornerVertices[0];
			}
			else {
				capCorners[0] = cornerVertices[1];
				capCorners[1] = cornerVertices[4];
				capCorners[2] = cornerVertices[2];
				capCorners[3] = cornerVertices[0];
			}
			for(int c = 0; c < 4; c++)
				if(capCorners[c]) capCorners[c]->setFlag(OUTPUT_VERTEX_VISITED);

			vector<OutputVertex*> borderVertices;
			for(map<FloatType, OutputVertex*>::const_iterator iter = corners[0][0].begin(); iter != corners[0][0].end(); ++iter)
				borderVertices.push_back(iter->second);
			if(capCorners[0]) borderVertices.push_back(capCorners[0]);
			for(map<FloatType, OutputVertex*>::const_iterator iter = corners[1][1].begin(); iter != corners[1][1].end(); ++iter)
				borderVertices.push_back(iter->second);
			if(capCorners[1]) borderVertices.push_back(capCorners[1]);
			for(map<FloatType, OutputVertex*>::const_iterator iter = corners[0][1].end(); iter != corners[0][1].begin(); ) {
				--iter;
				borderVertices.push_back(iter->second);
			}
			if(capCorners[2]) borderVertices.push_back(capCorners[2]);
			for(map<FloatType, OutputVertex*>::const_iterator iter = corners[1][0].end(); iter != corners[1][0].begin(); ) {
				--iter;
				borderVertices.push_back(iter->second);
			}
			if(capCorners[3]) borderVertices.push_back(capCorners[3]);

			// Generate contours.
			tessellator.beginPolygon(facetNormal, planeNormal);

			for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
				OutputVertex* vertex = (*v);
				if(vertex->isClipVertex(dim1) && vertex->pos[dim1] == 0 && vertex->testFlag(OUTPUT_VERTEX_VISITED) && !vertex->testFlag(OUTPUT_VERTEX_IS_CORNER)) {
					tessellator.beginContour();
					for(;;) {
						if(vertex->testFlag(OUTPUT_VERTEX_VISITED) == false) break;
						tessellator.vertex(vertex->pos);
						vertex->clearFlag(OUTPUT_VERTEX_VISITED);

						OutputEdge* edge = vertex->edges;
						while(edge) {
							if(edge->facet != NULL && edge->vertex2->isClipVertex(dim1) && edge->vertex2->pos[dim1] == 0)
								break;
							edge = edge->nextEdge;
						}
						if(edge != NULL) {
							vertex = edge->vertex2;
						}
						else {
							vector<OutputVertex*>::const_iterator iter = find(borderVertices.begin(), borderVertices.end(), vertex);
							DISLOCATIONS_ASSERT_GLOBAL(iter != borderVertices.end());
							for(;;) {
								++iter;
								if(iter == borderVertices.end()) iter = borderVertices.begin();
								vertex = *iter;
								if(vertex->testFlag(OUTPUT_VERTEX_IS_CORNER)) {
									DISLOCATIONS_ASSERT_GLOBAL(vertex->testFlag(OUTPUT_VERTEX_VISITED));
									tessellator.vertex(vertex->pos);
									vertex->clearFlag(OUTPUT_VERTEX_VISITED);
								}
								else break;
							}
						}
					}
					tessellator.endContour();
				}
			}

			if(capCorners[0] && capCorners[0]->testFlag(OUTPUT_VERTEX_VISITED)) {
				DISLOCATIONS_ASSERT(capCorners[1] && capCorners[1]->testFlag(OUTPUT_VERTEX_VISITED));
				DISLOCATIONS_ASSERT(capCorners[2] && capCorners[2]->testFlag(OUTPUT_VERTEX_VISITED));
				DISLOCATIONS_ASSERT(capCorners[3] && capCorners[3]->testFlag(OUTPUT_VERTEX_VISITED));
				tessellator.beginContour();
				for(int c = 0; c < 4; c++)
					tessellator.vertex(capCorners[c]->pos);
				tessellator.endContour();
			}
			tessellator.endPolygon();
		}

		size_t newVertexCount = capMesh.vertices.size();
		size_t newFacetCount = capMesh.facets.size();
		for(size_t i = oldVertexCount; i < newVertexCount; i++) {
			capMesh.createVertex(capMesh.vertices[i]->pos + planeNormal, -facetNormal);
		}
		for(size_t i = oldFacetCount; i < newFacetCount; i++) {
			OutputVertex* facetVertices[3];
			facetVertices[2] = capMesh.vertices[capMesh.facets[i]->edges[2]->vertex2->index - oldVertexCount + newVertexCount];
			facetVertices[1] = capMesh.vertices[capMesh.facets[i]->edges[0]->vertex2->index - oldVertexCount + newVertexCount];
			facetVertices[0] = capMesh.vertices[capMesh.facets[i]->edges[1]->vertex2->index - oldVertexCount + newVertexCount];
			capMesh.createFacetAndEdges(facetVertices);
		}
	}

#pragma omp parallel for
	for(int vindex = 0; vindex < capMesh.vertices.size(); vindex++) {
		OutputVertex* vertex = capMesh.vertices[vindex];
		vertex->pos = cell.getSimulationCellOrigin() + (cell.getSimulationCell() * (vertex->pos - ORIGIN));
	}
}

void OutputMesh::calculateNormals(const AnalysisEnvironment& cell){
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v)
		(*v)->normal = NULL_VECTOR;

	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		Vector3 normal = CrossProduct(cell.wrapVector((*f)->edges[1]->vertex2->pos - (*f)->edges[0]->vertex2->pos), cell.wrapVector((*f)->edges[2]->vertex2->pos - (*f)->edges[0]->vertex2->pos));
		if(normal != NULL_VECTOR) {
			normal = Normalize(normal);
			for(size_t v = 0; v < 3; v++)
				(*f)->edges[v]->vertex2->normal += normal;
		}
	}

	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v)
		(*v)->normal = NormalizeSafely((*v)->normal);
}

bool OutputMesh::pointInPolyhedron(const Point3 p, const AnalysisEnvironment& cell) const{
	OutputVertex* closestVertex = NULL;
	FloatType closestDistance2 = FLOATTYPE_MAX;
	Vector3 closestNormal = NULL_VECTOR, closestVector = NULL_VECTOR;
	for(vector<OutputVertex*>::const_iterator v = vertices.begin(); v != vertices.end(); ++v) {
		Vector3 r = cell.wrapReducedVector((*v)->pos - p);
		FloatType dist2 = LengthSquared(r);
		if(dist2 < closestDistance2) {
			closestDistance2 = dist2;
			closestVertex = *v;
			closestVector = r;
		}
	}

	OutputEdge* closestEdge = NULL;
	OutputFacet* closestFacet = NULL;
	for(vector<OutputFacet*>::const_iterator f = facets.begin(); f != facets.end(); ++f) {
		Vector3 edgeVectors[3];
		Vector3 vertexVectors[3];
		Point3 baseCorner = (*f)->edges[0]->vertex2->pos;
		Vector3 baseVector = cell.wrapReducedVector(baseCorner - p);

		for(int v = 0; v < 3; v++) {
			OutputEdge* e = (*f)->edges[v];
			Vector3 lineDir = cell.wrapReducedVector(e->vertex2->pos - e->vertex1()->pos);
			edgeVectors[v] = lineDir;
			Vector3 r = cell.wrapReducedVector(e->vertex1()->pos - baseCorner) + baseVector;
			vertexVectors[v] = r;
			FloatType edgeLength = Length(lineDir);
			if(edgeLength <= 1e-8) continue;
			lineDir /= edgeLength;
			FloatType d = DotProduct(lineDir, r);
			if(d >= edgeLength || d <= 0.0) continue;
			Point3 c = e->vertex2->pos - lineDir * d;
			Vector3 r2 = cell.wrapReducedVector(c - p);
			FloatType dist2 = LengthSquared(r2);
			if(dist2 < closestDistance2) {
				closestDistance2 = dist2;
				closestVertex = NULL;
				closestFacet = NULL;
				closestEdge = e;
				closestVector = r2;
			}
		}

		Vector3 normal = CrossProduct(edgeVectors[0], edgeVectors[1]);
		FloatType normalLengthSq = LengthSquared(normal);
		if(fabs(normalLengthSq) <= 1e-12) continue;
		bool isInsideTriangle = true;
		for(int v = 0; v < 3; v++) {
			if(DotProduct(vertexVectors[v], CrossProduct(normal, edgeVectors[v])) >= 0.0) {
				isInsideTriangle = false;
				break;
			}
		}
		if(isInsideTriangle) {
			normal /= sqrt(normalLengthSq);
			FloatType planeDist = DotProduct(normal, vertexVectors[0]);
			if(planeDist * planeDist < closestDistance2) {
				closestDistance2 = planeDist * planeDist;
				closestVector = normal * planeDist;
				closestVertex = NULL;
				closestEdge = NULL;
				closestFacet = *f;
				closestNormal = normal;
			}
		}
	}

	if(closestEdge != NULL) {
		LOG_INFO() << "POINT IN POLYHEDRON TEST: Edge is closest. WARNING: This is untested code! You may get wrong surface cap output.";
		OutputFacet* facets[2] = { closestEdge->facet, closestEdge->oppositeEdge->facet };
		closestNormal = NULL_VECTOR;
		for(int f = 0; f < 2; f++) {
			Vector3 edge1 = cell.wrapReducedVector(facets[f]->edges[0]->vertex2->pos - facets[f]->edges[0]->vertex1()->pos);
			Vector3 edge2 = cell.wrapReducedVector(facets[f]->edges[1]->vertex2->pos - facets[f]->edges[1]->vertex1()->pos);
			closestNormal += NormalizeSafely(CrossProduct(edge1, edge2));

		}
	}
	else if(closestVertex != NULL) {
		OutputEdge* edge = closestVertex->edges;
		DISLOCATIONS_ASSERT(edge != NULL);
		OutputFacet* facet = edge->facet;
		DISLOCATIONS_ASSERT(facet != NULL);
		closestNormal = NULL_VECTOR;
		Vector3 edge1v = NormalizeSafely(cell.wrapReducedVector(edge->vertex2->pos - closestVertex->pos));
		do {
			OutputEdge* nextEdge = facet->edges[(facet->edgeIndex(edge)+2)%3]->oppositeEdge;
			DISLOCATIONS_ASSERT(nextEdge->vertex1() == closestVertex);
			Vector3 edge2v = NormalizeSafely(cell.wrapReducedVector(nextEdge->vertex2->pos - closestVertex->pos));
			FloatType angle = acos(DotProduct(edge1v, edge2v));
			closestNormal += NormalizeSafely(CrossProduct(edge1v, edge2v)) * angle;
			facet = nextEdge->facet;
			edge = nextEdge;
			edge1v = edge2v;
		}
		while(edge != closestVertex->edges);
	}
	return DotProduct(closestNormal, closestVector) > 0.0;
}

void OutputMesh::refineFacets(const AnalysisEnvironment& cell, FloatType maxRatio, FloatType maxEdgeLength){
	FloatType maxRatioSquared = maxRatio * maxRatio;
	if(maxRatio == FLOATTYPE_MAX) maxRatioSquared = FLOATTYPE_MAX;
	FloatType maxEdgeLengthSquared = maxEdgeLength * maxEdgeLength;

	// Iterate over all edges.
	for(size_t findex = 0; findex < facets.size(); ) {
		OutputFacet* facet = facets[findex];
		FloatType longestWrappedEdgeLengthSq = 0;
		OutputEdge* longestWrappedEdge = NULL;
		FloatType longestEdgeLengthSq = 0;
		OutputEdge* longestEdge = NULL;
		FloatType shortestEdgeLengthSq = FLOATTYPE_MAX;
		for(int v = 0; v < 3; v++) {
			OutputEdge* e = facet->edges[v];
			Vector3 edgev = e->vertex2->pos - e->vertex1()->pos;
			FloatType lengthSq = LengthSquared(edgev);
			if(lengthSq > longestEdgeLengthSq) {
				longestEdgeLengthSq = lengthSq;
				longestEdge = e;
			}
			if(lengthSq > longestWrappedEdgeLengthSq && cell.isWrappedVector(edgev)) {
				longestWrappedEdgeLengthSq = lengthSq;
				longestWrappedEdge = e;
			}
			if(lengthSq < shortestEdgeLengthSq)
				shortestEdgeLengthSq = lengthSq;
		}
		if(longestWrappedEdge != NULL)
			longestEdge = longestWrappedEdge;
		if(longestEdge == NULL) {
			findex++;
			continue;
		}

		OutputVertex* vertex1 = longestEdge->vertex1();
		OutputVertex* vertex2 = longestEdge->vertex2;
		Vector3 edgev = vertex2->pos - vertex1->pos;
		if(longestWrappedEdge != NULL || longestEdgeLengthSq > maxEdgeLengthSquared ||
				(shortestEdgeLengthSq > FLOATTYPE_EPSILON && longestEdgeLengthSq / shortestEdgeLengthSq > maxRatioSquared)) {

			OutputVertex* splitVertex = createVertex(vertex2->pos - (FloatType)0.5 * edgev);
			splitVertex->normal = vertex1->normal;
			splitVertex->numFacets = 2;

			OutputEdge* edge1 = longestEdge;
			OutputEdge* edge3 = longestEdge->oppositeEdge;
			DISLOCATIONS_ASSERT(edge3 != NULL);

			OutputFacet* facet1 = facet;
			OutputFacet* facet2 = facetPool.construct();
			OutputEdge* thirdEdge1 = facet1->nextEdge(longestEdge);
			OutputVertex* thirdVertex1 = thirdEdge1->vertex2;

			OutputEdge* edge2 = edgePool.construct();
			OutputEdge* edge4 = edgePool.construct();

			OutputEdge* splitEdge1 = edgePool.construct();
			OutputEdge* splitEdge1opp = edgePool.construct();
			splitEdge1->oppositeEdge = splitEdge1opp;
			splitEdge1opp->oppositeEdge = splitEdge1;
			splitEdge1->vertex2 = thirdVertex1;
			splitEdge1opp->vertex2 = splitVertex;
			splitEdge1opp->nextEdge = thirdVertex1->edges;
			thirdVertex1->edges = splitEdge1opp;
			thirdVertex1->numFacets++;
			splitEdge1->nextEdge = splitVertex->edges;
			splitVertex->edges = splitEdge1;
			edge2->vertex2 = vertex2;
			edge2->nextEdge = splitVertex->edges;
			splitVertex->edges = edge2;
			edge1->vertex2 = splitVertex;

			facets.push_back(facet2);
			facet2->entity = facet1->entity;
			facet2->edges[0] = edge2;
			facet2->edges[1] = thirdEdge1;
			facet2->edges[2] = splitEdge1opp;
			edge2->facet = facet2;
			thirdEdge1->facet = facet2;
			splitEdge1opp->facet = facet2;
			facet1->edges[facet1->edgeIndex(thirdEdge1)] = splitEdge1;
			splitEdge1->facet = facet1;

			edge4->facet = NULL;
			edge4->vertex2 = vertex1;
			edge4->nextEdge = splitVertex->edges;
			splitVertex->edges = edge4;
			edge3->vertex2 = splitVertex;

			edge3->oppositeEdge = edge2;
			edge2->oppositeEdge = edge3;
			edge4->oppositeEdge = edge1;
			edge1->oppositeEdge = edge4;

			OutputFacet* facet3 = edge3->facet;
			if(facet3 != NULL) {
				splitVertex->numFacets = 4;
				OutputFacet* facet4 = facetPool.construct();
				OutputEdge* thirdEdge2 = facet3->nextEdge(edge3);
				OutputVertex* thirdVertex2 = thirdEdge2->vertex2;

				OutputEdge* splitEdge2 = edgePool.construct();
				OutputEdge* splitEdge2opp = edgePool.construct();
				splitEdge2->oppositeEdge = splitEdge2opp;
				splitEdge2opp->oppositeEdge = splitEdge2;
				splitEdge2->vertex2 = thirdVertex2;
				splitEdge2opp->vertex2 = splitVertex;
				splitEdge2opp->nextEdge = thirdVertex2->edges;
				thirdVertex2->edges = splitEdge2opp;
				thirdVertex2->numFacets++;
				splitEdge2->nextEdge = splitVertex->edges;
				splitVertex->edges = splitEdge2;

				facets.push_back(facet4);
				facet4->entity = facet3->entity;
				facet4->edges[0] = edge4;
				facet4->edges[1] = thirdEdge2;
				facet4->edges[2] = splitEdge2opp;
				edge4->facet = facet4;
				thirdEdge2->facet = facet4;
				splitEdge2opp->facet = facet4;
				facet3->edges[facet3->edgeIndex(thirdEdge2)] = splitEdge2;
				splitEdge2->facet = facet3;

			}
		}
		else findex++;
	}
}

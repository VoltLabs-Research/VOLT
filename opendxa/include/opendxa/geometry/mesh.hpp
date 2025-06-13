#ifndef __DXA_OUTPUT_MESH_H
#define __DXA_OUTPUT_MESH_H

#include <opendxa/includes.hpp>
#include <opendxa/engine/analysis_environment.hpp>
#include <opendxa/utils/memory_pool.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

struct OutputVertex;
struct OutputEdge;
struct OutputFacet;

struct OutputEdge
{
	OutputEdge* oppositeEdge;
	OutputVertex* vertex2;
	OutputFacet* facet;
	OutputEdge* nextEdge;

	OutputVertex* vertex1() const { return oppositeEdge->vertex2; }
};

enum OutputVertexBitFlags {
	OUTPUT_VERTEX_CLIPX = 0,
	OUTPUT_VERTEX_CLIPY = 1,
	OUTPUT_VERTEX_CLIPZ = 2,
	OUTPUT_VERTEX_IS_FIXED = 3,
	OUTPUT_VERTEX_VISITED = 4,
	OUTPUT_VERTEX_IS_CORNER = 5,
};

enum OutputFacetBitFlags {
	OUTPUT_FACET_VISITED = 0,
	OUTPUT_FACET_IS_DISCLINATION_BARRIER = 1,
};

struct OutputVertex
{
	Point3 pos;
	Vector3 normal;
	Vector3 laplacian;
	unsigned int flags;
	int index;
	int numFacets;
	OutputEdge* edges;

	bool testFlag(OutputVertexBitFlags which) const { return (flags & (1<<which)) != 0; }
	void setFlag(OutputVertexBitFlags which) { flags |= (1<<which); }
	void clearFlag(OutputVertexBitFlags which) { flags &= ~(1<<which); }

	bool isClipVertex(int dim) const { return (flags & (1<<dim)) != 0; }
	void setClipVertex(int dim) { flags |= (1<<dim); }
};

struct OutputFacet
{
	OutputEdge* edges[3];
	int entity;
	unsigned int flags;

	bool testFlag(OutputFacetBitFlags which) const { return (flags & (1<<which)) != 0; }
	void setFlag(OutputFacetBitFlags which) { flags |= (1<<which); }
	void clearFlag(OutputFacetBitFlags which) { flags &= ~(1<<which); }

	int edgeIndex(OutputEdge* edge) const {
		if(edges[0] == edge) return 0;
		if(edges[1] == edge) return 1;
		if(edges[2] == edge) return 2;
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return -1;
	}

	OutputEdge* nextEdge(OutputEdge* edge) const {
		if(edges[0] == edge) return edges[1];
		if(edges[1] == edge) return edges[2];
		if(edges[2] == edge) return edges[0];
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return NULL;
	}

	OutputEdge* previousEdge(OutputEdge* edge) const {
		if(edges[0] == edge) return edges[2];
		if(edges[1] == edge) return edges[0];
		if(edges[2] == edge) return edges[1];
		DISLOCATIONS_ASSERT_GLOBAL(false);
		return NULL;
	}
};

class OutputMesh{
public:
	void clear();
	json writeToVTKFile();

	OutputVertex* createVertex(const Point3& pos, const Vector3& normal = NULL_VECTOR);
	OutputEdge* createEdge(OutputVertex* vertex1, OutputVertex* vertex2);
	OutputFacet* createFacet(OutputEdge* edges[3], int entity = 0);
	OutputFacet* createFacetAndEdges(OutputVertex* vertices[3], int entity = 0);

	void smoothMesh(int smoothingLevel, const AnalysisEnvironment& cell);
	void smoothMesh(FloatType prefactor, const AnalysisEnvironment& cell, bool projectToNormals);
	void wrapMesh(const AnalysisEnvironment& cell, OutputMesh* capMesh = NULL);
	void calculateNormals(const AnalysisEnvironment& cell);
	bool pointInPolyhedron(const Point3 p, const AnalysisEnvironment& cell) const;
	void refineFacets(const AnalysisEnvironment& cell, FloatType maxRatio = FLOATTYPE_MAX, FloatType maxEdgeLength = FLOATTYPE_MAX);

	const vector<OutputFacet*>& getFacets() const { return facets; }

private:
	void splitEdge(OutputEdge* edge, const AnalysisEnvironment& cell, int dim);
	void splitFacet(OutputFacet* facet1, OutputEdge* edge1, OutputEdge* edge2, OutputVertex* intersectionPoint1, OutputVertex* intersectionPoint2, int dim);
	void createCaps(const AnalysisEnvironment& cell, OutputMesh& capMesh, OutputVertex* cornerVertices[8]);

	vector<OutputVertex*> vertices;
	MemoryPool<OutputVertex> vertexPool;
	MemoryPool<OutputEdge> edgePool;
	vector<OutputFacet*> facets;
	MemoryPool<OutputFacet> facetPool;
};

#endif
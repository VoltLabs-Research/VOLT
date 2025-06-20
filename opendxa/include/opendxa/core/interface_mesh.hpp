#ifndef OPENDXA_INTERFACE_MESH_H
#define OPENDXA_INTERFACE_MESH_H

#include <opendxa/includes.hpp>
#include <opendxa/core/clustering.hpp>
#include <opendxa/structures/mesh/mesh.hpp>
#include <opendxa/geometry/mesh.hpp>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class InterfaceMesh : public Clustering{
public:
	InterfaceMesh();
	~InterfaceMesh() { cleanup(); }

	json getInterfaceMeshData();

	void createInterfaceMeshNodes();
	void createInterfaceMeshEdges();
	void createInterfaceMeshFacets();
	void smoothOutputSurface(int smoothingLevel);
	void finishOutputSurface(bool createCapSurface);
	void validateInterfaceMesh(bool x) const;
	void cleanup();

protected:
	void createFCCHCPMeshEdges(InputAtom* atom);
	void createBCCMeshEdges(InputAtom* atom);
	void createFCCHCPMeshFacets(InputAtom* atom);
	void createBCCMeshFacets(InputAtom* atom);
	void createMeshNodeRecursive(InputAtom* a, BaseAtom* neighbor, MeshNode* node, int depth, vector<InputAtom*>& visitedAtoms, const Point3& currentCoord);
	void createAdjacentQuad(BaseAtom* center, MeshNode* vertex1, MeshNode* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2);
	void closeFacetHoles();
	void createFacetAndEdges(int numVertices, MeshNode** vertices, const LatticeVector* edgeVectors);
	void createFacet(int numVertices, MeshNode** vertices, MeshEdge** edges, int selection = 0);
	void fixMeshEdges();
	void removeUnnecessaryFacets();
	void duplicateSharedMeshNodes();

	bool constructFacetRecursive(int numEdges, int maxEdges, MeshNode** vertices, MeshEdge** edges, const LatticeVector& burgersVector);
	bool edgeEdgeOrientation(MeshEdge* edge1, MeshEdge* edge2);
	bool createAdjacentTriangle(MeshNode* center, MeshNode* vertex1, BaseAtom* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2);
	bool isWrappedFacet(MeshFacet* facet) const;
	bool isWrappedEdge(MeshEdge* edge) const;

	vector<MeshNode*> nodes;
	MemoryPool<MeshNode> nodePool;
	vector<MeshFacet*> facets;
	MemoryPool<MeshFacet> facetPool;
	OutputMesh outputMesh;
	OutputMesh outputMeshCap;
};

#endif

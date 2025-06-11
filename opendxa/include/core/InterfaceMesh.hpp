#ifndef __DXA_INTERFACE_MESH_H
#define __DXA_INTERFACE_MESH_H

#include "../Includes.hpp"
#include "core/Clustering.hpp"
#include "InterfaceMesh.hpp"
#include "../geometry/Mesh.hpp"

class DXAInterfaceMesh : public DXAClustering{
public:
	DXAInterfaceMesh();
	~DXAInterfaceMesh() { cleanup(); }

	void createInterfaceMeshNodes();
	void createInterfaceMeshEdges();
	void createInterfaceMeshFacets();
	void smoothOutputSurface(int smoothingLevel);
	void finishOutputSurface(bool createCapSurface);

	void writeInterfaceMeshFile(ostream& stream) const;
	void writeOpenMeshEdges(ostream& stream, bool skipDeadEdges = false) const;
	void writeOutputMeshFile(ostream& stream) const;
	void writeOutputMeshCapFile(ostream& stream) const;
	void cleanup();
	void validateInterfaceMesh();

protected:
	void createFCCHCPMeshEdges(InputAtom* atom);
	void createBCCMeshEdges(InputAtom* atom);
	void createFCCHCPMeshFacets(InputAtom* atom);
	void createBCCMeshFacets(InputAtom* atom);
	void createMeshNodeRecursive(InputAtom* a, BaseAtom* neighbor, MeshNode* node, int depth, vector<InputAtom*>& visitedAtoms, const Point3& currentCoord);
	bool createAdjacentTriangle(MeshNode* center, MeshNode* vertex1, BaseAtom* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2);
	void createAdjacentQuad(BaseAtom* center, MeshNode* vertex1, MeshNode* vertex2, const LatticeVector& edgeVector1, const LatticeVector& edgeVector2);
	void closeFacetHoles();
	bool constructFacetRecursive(int numEdges, int maxEdges, MeshNode** vertices, MeshEdge** edges, const LatticeVector& burgersVector);
	void createFacetAndEdges(int numVertices, MeshNode** vertices, const LatticeVector* edgeVectors);
	void createFacet(int numVertices, MeshNode** vertices, MeshEdge** edges, int selection = 0);
	bool edgeEdgeOrientation(MeshEdge* edge1, MeshEdge* edge2);
	void fixMeshEdges();
	void removeUnnecessaryFacets();
	void duplicateSharedMeshNodes();

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


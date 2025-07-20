#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/analysis/burgers_loop_builder.h>
#include <opendxa/geometry/manifold_construction_helper.h>
#include <algorithm>
#include <array>
#include <numeric>
#include <cassert>
#include <set> 
#include <boost/dynamic_bitset.hpp>

namespace OpenDXA{

void InterfaceMesh::makeManifold(){
    auto original_vertices = vertices(); 

    for(auto* vertex : original_vertices){
        if(vertex->numEdges() < 3) continue;

        std::set<Edge*> visited_edges;
        Edge* start_edge = vertex->edges();
        Edge* current_edge = start_edge;
        do{
            visited_edges.insert(current_edge);
            current_edge = current_edge->oppositeEdge()->nextFaceEdge();
        }while(current_edge != start_edge);

        if(visited_edges.size() == vertex->numEdges()){
            continue;
        }

        while(visited_edges.size() < vertex->numEdges()){
            Vertex* new_vertex = createVertex(vertex->pos());
            Edge* fan_start_edge = nullptr;
            for(Edge* e = vertex->edges(); e != nullptr; e = e->nextVertexEdge()){
                if(visited_edges.find(e) == visited_edges.end()){
                    fan_start_edge = e;
                    break;
                }
            }
            
            if(fan_start_edge == nullptr) break;

            std::vector<Edge*> fan_to_transfer;
            current_edge = fan_start_edge;
            do{
                fan_to_transfer.push_back(current_edge);
                visited_edges.insert(current_edge);
                current_edge = current_edge->oppositeEdge()->nextFaceEdge();
            }while(current_edge != fan_start_edge);

            for(Edge* edge_to_move : fan_to_transfer){
                vertex->transferEdgeToVertex(edge_to_move, new_vertex);
            }
        }
    }
}

// Build a watertight surface mesh over the interface where material properties may change
// (e.g, grain or cluster boundaries). We use a Delaunay Tessellation to generate tetrahedra,
// then carve out only those facets whose endpoints belongs to "compatible" clusters (as determined
// by the elastic mapping). Faces that bridge incompatible clusters get omitted, leaving
// a manifold of boundary faces.
void InterfaceMesh::createMesh(double maxNeighborDist){
    _isCompletelyGood = true;
    _isCompletelyBad  = true;

    // Classify each tetrahedron. Return 1 to keep its faces if its interior is
    // "elastic-compatible" (no large strain or cell-size mismatch), otherwise 0.
    auto tetraRegion = [&](auto cell) -> unsigned {
        if(!elasticMapping().isElasticMappingCompatible(cell)){
            // Found at least one bad tetrahedra
			_isCompletelyGood = false;

            // Omit all faces of this cell
			return 0;
		}

        // At least one good tetrahedra exists.
		_isCompletelyBad = false;

        // Keep its faces
		return 1;
    };

    // Initialize each triangular face by copying its three vertex positions,
    // computing the physical (Cartesian) edge vectors, and looking up the
    // "ideal" cluster-to-cluster displacement and rotation that went into 
    // generating those vertices. Also detect if any PBC wrapping would
    // imply the simulation cell is too small for the neighbor distance.
    auto prepareFace = [&](
		Face* face,
		std::array<int, 3> const& vIdx,
		std::array<decltype(tessellation().cellVertex(0,0)),3> const& vH,
		auto cell
	){
        std::array<Point3, 3> pos = {
            tessellation().vertexPosition(vH[0]),
            tessellation().vertexPosition(vH[1]),
            tessellation().vertexPosition(vH[2])
        };

        auto* e = face->edges();
        for(int i = 0; i < 3; ++i){
            int ni = (i + 1) % 3;
            // Compute the actual displacement vector between the two vertices
            e->physicalVector = pos[ni] - pos[i];

            // Verify that no coordinate exceeds half the cell length in that axis,
            // which would imply we need a larger box or ghost cells
            for(int d = 0; d < 3; ++d){
                if(structureAnalysis().cell().pbcFlags()[d]){
                    if(std::abs(
                        structureAnalysis().cell().inverseMatrix().prodrow(e->physicalVector, d)
					) >= double{0.5} + EPSILON)
                    {
                        CoordinationStructures::generateCellTooSmallError(d);
                    }
                }
            }

            // Query the elastic mapping to find the cluster-to-cluster shift and rotation
            // that ideally produced this edge. We store both the local Burgers-vector-like "clusterVector"
            // and the small rotation "clusterTransition" that maps between the two grain orientations.
            std::tie(e->clusterVector, e->clusterTransition) = elasticMapping().getEdgeClusterVector(vIdx[i], vIdx[ni]);
            e = e->nextFaceEdge();
        }
    };

    // We pad the ghost layer size by several neighbor distances to ensure
    // all relevant tetrahedra are built across the periodic box. The manifold
    // helper will call back into our lambdas to decide which test and faces to keep.
    double alpha = 5.0 * maxNeighborDist;
    ManifoldConstructionHelper<InterfaceMesh> helper{
        tessellation(),
        *this,
        alpha,
        structureAnalysis().positions()
    };

    // Build the faces and topology. If any step fails, bail out.
    if(!helper.construct(tetraRegion, prepareFace)){
        throw std::runtime_error("Error building the faces and topology.");
	}

    makeManifold();
}

// After tracing dislocation circuits on the interface mesh, extract only
// those triangular facets that lie inside dislocation "holes" or caps
// on dangling circuits. We produce a separate half-edge mesh for defect surfaces,
// stitching in new triangles around each dangling Burgers circuit cap. 
void InterfaceMesh::generateDefectMesh(
    BurgersLoopBuilder const& tracer,
    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& outMesh
){
    // Copy all interface vertices into the output mesh at the same indices
    outMesh.reserveVertices(vertexCount());
    for(auto* v : vertices()){
        auto* nv = outMesh.createVertex(v->pos());
        //assert(nv->index() == v->index());
    }

    // Build every face that is not "blocked" by a valid Burger circuit,
    // skipping those with a dangling circuit (holes).
	std::vector<Face*> faceMap;
    faceMap.reserve(faces().size());

    for(auto* f : faces()){
        // Skip faces that lie on any kept Burgers-circuit boundary
        if(f->circuit && (f->testFlag(1) || !f->circuit->isDangling)){
            faceMap.push_back(nullptr);
            continue;
        }

        // Otherwise create a new triangular face in the output mesh
        auto* nf = outMesh.createFace();
        faceMap.push_back(nf);

        // Walk its three edges in order and add half-edges
        if(auto* e = f->edges()){
            auto* start = e;
            do{
                auto* v1 = outMesh.vertex(e->vertex1()->index());
                auto* v2 = outMesh.vertex(e->vertex2()->index());
                outMesh.createEdge(v1, v2, nf);
                e = e->nextFaceEdge();
            }while(e != start);
        }
    }

    // Link opposite half-edges across triangle boundaries
    for(size_t i = 0; i < faces().size(); ++i){
        auto* of = faces()[i];
        auto* nf = faceMap[i];
        if(!nf || !of->edges()) continue;

        auto* eo = of->edges();
        auto* en = nf->edges();
        auto* startO = eo;
        do{
            if(eo->oppositeEdge() && !en->oppositeEdge()){
                auto* oppNF = faceMap[eo->oppositeEdge()->face()->index()];
                if(oppNF){
                    auto* ec = oppNF->edges();
                    auto* startC = ec;
                    do{
                        if(ec->vertex1() == en->vertex2() && ec->vertex2() == en->vertex1()){
                            en->linkToOppositeEdge(ec);
                            break;
                        }

                        ec = ec->nextFaceEdge();
                    }while(ec != startC);
                }
            }

            eo = eo->nextFaceEdge();
            en = en->nextFaceEdge();
        }while(eo != startO);
    }

    // For each dangling BurgersCircuit, cap its hole by creating
    // a new vertex at the circuit's center and stitching triangles 
    // between each edge of that circuit loop and the new cap vertex.
    for(auto* dn : tracer.danglingNodes()){
        auto* c = dn->circuit;
        //assert(c && c->segmentMeshCap.size() >= 2);

        // Add a cap vertex at the circuit center
        auto* capV = outMesh.createVertex(dn->position());
        
        for(auto* me : c->segmentMeshCap){
            // The corresponding face has no mapping (we skip it), so we 
            // explicitly build a new triangle: edge end1 -> end2 -> capV
            //assert(!faceMap[me->oppositeEdge()->face()->index()]);
            auto* v1 = outMesh.vertex(me->vertex2()->index());
            auto* v2 = outMesh.vertex(me->vertex1()->index());
            auto* nf = outMesh.createFace();
            outMesh.createEdge(v1, v2, nf);
            outMesh.createEdge(v2, capV, nf);
            outMesh.createEdge(capV, v1, nf);
        }
    }

    // Finally, ensure all half-edges know their opposite partners.
    // TODO:
    // assert(outMesh.connectOppositeHalfedges());
}

}
#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/burgers_loop_builder.h>
#include <opendxa/analysis/crystal_path_finder.h>
#include <opendxa/analysis/elastic_mapping.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <tbb/parallel_for.h>
#include <tbb/concurrent_vector.h>
#include <tbb/parallel_sort.h>
#include <omp.h>
#include <mutex>
#include <execution>
#include <algorithm>
#include <atomic>

namespace OpenDXA{

static constexpr std::array<std::pair<int, int>, 6> tetraEdgeVertices{{
    {0, 1}, {0, 2}, {0, 3},
    {1, 2}, {1, 3}, {2, 3}
}};

// In order to measure how each tetrahedron in our Delaunay mesh connects
// two atoms across the grain boundary, we talk every tetrahedral cell and record each
// of its six edges exactly once. We skip any "ghost" cells that lie outside the
// real simulation box. For each real edge, we look up the two vertex IDs (v1, v2),
// skip degenerate or wrapped edges, and then build a TessellationEdge object if that
// connection has not already been recorded. Each new edge is inserted into two linked
// lists: one at its source vertex (edges leaving) and one at its destination vertex
// (edges arriving), so that we can later traverse all edges adjacent to any given vertex.
void ElasticMapping::generateTessellationEdges(){
    struct TempEdge {
        int v1, v2;
        bool operator<(const TempEdge& other) const {
            if(v1 != other.v1) return v1 < other.v1;
            return v2 < other.v2;
        }
        bool operator==(const TempEdge& other) const {
            return v1 == other.v1 && v2 == other.v2;
        }
    };

    tbb::concurrent_vector<TempEdge> potentialEdges;
    const auto &simCell = structureAnalysis().context().simCell;

    tbb::parallel_for(tbb::blocked_range<size_t>(0, tessellation().numberOfTetrahedra()), 
        [&](const tbb::blocked_range<size_t>& r) {
        for(size_t cellIdx = r.begin(); cellIdx != r.end(); ++cellIdx){
            if(tessellation().isGhostCell(cellIdx)) continue;

            for(auto [vi, vj] : tetraEdgeVertices){
                int v1 = tessellation().vertexIndex(tessellation().cellVertex(cellIdx, vi));
                int v2 = tessellation().vertexIndex(tessellation().cellVertex(cellIdx, vj));

                if(v1 == v2) continue;

                Point3 p1 = tessellation().vertexPosition(tessellation().cellVertex(cellIdx, vi));
                Point3 p2 = tessellation().vertexPosition(tessellation().cellVertex(cellIdx, vj));

                if(simCell.isWrappedVector(p1 - p2)) continue;

                int minV = std::min(v1, v2);
                int maxV = std::max(v1, v2);
                potentialEdges.push_back({minV, maxV});
            }
        }
    });

    if(potentialEdges.empty()) return;

    tbb::parallel_sort(potentialEdges.begin(), potentialEdges.end());
    
    // De-duplicate
    std::vector<TempEdge> uniqueEdges;
    uniqueEdges.reserve(potentialEdges.size());
    if(!potentialEdges.empty()){
        uniqueEdges.push_back(potentialEdges[0]);
        for(size_t i = 1; i < potentialEdges.size(); ++i){
            if(!(potentialEdges[i] == uniqueEdges.back())){
                uniqueEdges.push_back(potentialEdges[i]);
            }
        }
    }

    _edgeCount = static_cast<int>(uniqueEdges.size());
    for(const auto& te : uniqueEdges){
        TessellationEdge* e = _edgePool.construct(te.v1, te.v2);
        
        e->nextLeavingEdge = _vertexEdges[te.v1].first;
        _vertexEdges[te.v1].first = e;

        e->nextArrivingEdge = _vertexEdges[te.v2].second;
        _vertexEdges[te.v2].second = e;
    }
}

// Once we have a graph of edges connecting mesh vertices, we need to assign
// each vertex to the grain (cluster) it belongs to.
// Initially, vertices that coincide exactly with an atomic cluster
// center get that cluster's ID; other vertices start with zero.
// In a simple propagation loop, we look at each unassigned vertex and check
// its neighboring vertices (both edges leaving and arriving).
// As soon as it touches a vertex already assigned to a nonzero cluster,
// we adopt that cluster ID. We repeat the scan until no changes occur,
// so that every vertex on the interface inherits the grain identity
// from at lesat one of its neighbors.
void ElasticMapping::assignVerticesToClusters(){
    const size_t vertex_count = _vertexClusters.size();
    
    #pragma omp parallel for schedule(static) 
    for(size_t i = 0; i < vertex_count; ++i){
        _vertexClusters[i] = structureAnalysis().atomCluster(int(i));
    }

    bool changed;
    do{
        std::atomic<bool> any_changed{false};
        
        tbb::parallel_for(tbb::blocked_range<int>(0, static_cast<int>(vertex_count)), [&](const tbb::blocked_range<int>& r){
            bool local_changed = false;
            for(int idx = r.begin(); idx != r.end(); ++idx){
                if(clusterOfVertex(idx)->id != 0) continue;

                for(auto* e = _vertexEdges[idx].first; e; e = e->nextLeavingEdge){
                    if(clusterOfVertex(e->vertex2)->id != 0){
                        _vertexClusters[idx] = _vertexClusters[e->vertex2];
                        local_changed = true;
                        break;
                    }
                }

                if(clusterOfVertex(idx)->id != 0) continue;

                for(auto* e = _vertexEdges[idx].second; e; e = e->nextArrivingEdge){
                    if(clusterOfVertex(e->vertex1)->id != 0){
                        _vertexClusters[idx] = _vertexClusters[e->vertex1];
                        local_changed = true;
                        break;
                    }
                }
            }
            if(local_changed) any_changed = true;
        });
        
        changed = any_changed.load();
    }while(changed);
}

// With every mesh edge now knowing the grain ID of its two endpoints, we want to compute
// an "ideal" Burgers vector on each edge so that when we later trace dislocation loops
// we know how the lattice would distort ideally between the two grains.
// We instantiate a helper class, CrystalPatFinder, which can find a lattice-aligned path
// between two atomic sites. For each edge that doesn't already have a vector, we check
// that both its vertices belong to valid clusters. We the ask the path finder for the 
// ideal vector and the grain where that vector originates. If necessary, we apply the inverse
// of the transition that brough that vector from its source cluster into the first cluster,
// then compose with the transition from the first cluster to the second. The final result
// is stored on the edge so that later elastic compatibility checks can 
// verify closed-loops balances.
void ElasticMapping::assignIdealVectorsToEdges(bool reconstructEdgeVectors, int crystalPathSteps){
    tbb::parallel_for(tbb::blocked_range<size_t>(0, _vertexEdges.size()), [&](const tbb::blocked_range<size_t>& r){
        CrystalPathFinder pathFinder{ structureAnalysis(), crystalPathSteps };
        for(size_t headIdx = r.begin(); headIdx != r.end(); ++headIdx){
            for(auto* edge = _vertexEdges[headIdx].first; edge; edge = edge->nextLeavingEdge){
                if(edge->hasClusterVector()) { continue; }

                Cluster* c1 = clusterOfVertex(edge->vertex1);
                Cluster* c2 = clusterOfVertex(edge->vertex2);
                
                if(c1->id == 0 || c2->id == 0) continue;

                if(auto optCv = pathFinder.findPath(edge->vertex1, edge->vertex2)){
                    Vector3 localVec = optCv->localVec();
                    Cluster* srcCl = optCv->cluster();

                    Vector3 vecInC1;
                    if(srcCl == c1){
                        vecInC1 = localVec;
                    }else if(auto* tr = clusterGraph().determineClusterTransition(srcCl, c1)){
                        vecInC1 = tr->transform(localVec);
                    }else{
                        continue;
                    }

                    if(auto* tr12 = clusterGraph().determineClusterTransition(c1, c2)){
                        edge->assignClusterVector(vecInC1, tr12);
                    }
                }
            }
        }
    });
}

// Before accepting the elastic mapping as valid for simulation or further analysis
// we must confirm that every tetrahedron's six edges close consistently. That means each
// triangular face in the tetrahedron must satisfy both:
// 1) The sum of Burgers vectors around that triange is zero.
// 2) Any lattice symmetry transitions across those edges combine to the identity rotation.
// We extract each of the four unique 3-edge circuits on the tetrahedron, transform
// and sum their stored vectors, and test for zero magnitude.
// We likewise compose their transition matrices and confirm no net rotation.
// If any check fails, the mapping is compatible and we return false.
bool ElasticMapping::isElasticMappingCompatible(DelaunayTessellation::CellHandle cell) const{
    if(!tessellation().isValidCell(cell)) return false;

    // Gather each of the six edge's vector and transition
    std::array<std::pair<Vector3, ClusterTransition*>, 6> edgeVecs;
    for(int i = 0; i < 6; ++i){
        auto [vi, vj] = tetraEdgeVertices[i];
        int v1 = tessellation().vertexIndex(tessellation().cellVertex(cell, vi));
        int v2 = tessellation().vertexIndex(tessellation().cellVertex(cell, vj));
        auto* te = findEdge(v1, v2);

        // Every edge must exist and have a stored vector
        if(!te || !te->hasClusterVector()){
            return false;
		}

        // Make sure the vector is always oriented from v1 to v2
        if(te->vertex1 == v1){
            edgeVecs[i] = { te->clusterVector, te->clusterTransition };
        }else{
            // If reversed, invert the vector and use the reverse transition
            edgeVecs[i] = {
                te->clusterTransition->transform(-te->clusterVector),
                te->clusterTransition->reverse
            };
        }
    }

    // Define four triangular loops on a tetrahedron by edge indices
    static constexpr std::array<std::array<int, 3>, 4> circuits{{
        {{0, 4, 2}}, {{1, 5, 2}}, {{0, 3, 1}}, {{3, 5, 4}}
    }};

    // Check that the vector sum around each triangle is zero
    for(auto const& c : circuits){
        Vector3 B = edgeVecs[c[0]].first
                  + edgeVecs[c[0]].second->reverseTransform(edgeVecs[c[1]].first)
                  - edgeVecs[c[2]].first;

        if(!B.isZero(CA_LATTICE_VECTOR_EPSILON)) return false;
    }

    // Check that the combine rotations around each triangle are identity
    for(auto const& c : circuits){
        auto* t1 = edgeVecs[c[0]].second;
        auto* t2 = edgeVecs[c[1]].second;
        auto* t3 = edgeVecs[c[2]].second;
        if(!t1->isSelfTransition() ||
            !t2->isSelfTransition() ||
            !t3->isSelfTransition()
		){
            Matrix3 R = t3->reverse->tm * t2->tm * t1->tm;
            if(!R.equals(Matrix3::Identity(), CA_TRANSITION_MATRIX_EPSILON)) return false;
        }
    }

    return true;
}

void ElasticMapping::releaseCaches() noexcept{
    _edgePool.clear();
    _edgeCount = 0;
    std::vector<std::pair<TessellationEdge*, TessellationEdge*>>().swap(_vertexEdges);
    std::vector<Cluster*>().swap(_vertexClusters);
}

}

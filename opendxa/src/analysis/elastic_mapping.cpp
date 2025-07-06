#include <opendxa/core/opendxa.h>
#include <opendxa/analysis/dislocation_tracer.h>
#include <opendxa/analysis/crystal_path_finder.h>
#include <opendxa/analysis/elastic_mapping.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <omp.h>
#include <mutex>

namespace OpenDXA{

static constexpr std::array<std::pair<int, int>, 6> tetraEdgeVertices{{
    {0, 1}, {0, 2}, {0, 3},
    {1, 2}, {1, 3}, {2, 3}
}};

bool ElasticMapping::generateTessellationEdges(){
    for(DelaunayTessellation::CellHandle cell : tessellation().cells()){
        if(tessellation().isGhostCell(cell)){
            continue;
		}

        for(auto [vi, vj] : tetraEdgeVertices){
            int v1 = tessellation().vertexIndex(tessellation().cellVertex(cell, vi));
            int v2 = tessellation().vertexIndex(tessellation().cellVertex(cell, vj));
            if(v1 == v2) continue;

            Point3 p1 = tessellation().vertexPosition(tessellation().cellVertex(cell, vi));
            Point3 p2 = tessellation().vertexPosition(tessellation().cellVertex(cell, vj));

            if(structureAnalysis().cell().isWrappedVector(p1 - p2)) continue;

            assert(v1 >= 0 && v2 >= 0);
            if(findEdge(v1, v2) == nullptr){
                TessellationEdge* e = _edgePool.construct(v1, v2);
                e->nextLeavingEdge  = _vertexEdges[v1].first;

				_vertexEdges[v1].first = e;
                e->nextArrivingEdge = _vertexEdges[v2].second;

				_vertexEdges[v2].second = e;
                ++_edgeCount;
            }
        }
    }

    return true;
}

bool ElasticMapping::assignVerticesToClusters(){
    const size_t vertex_count = _vertexClusters.size();
    
    #pragma omp parallel for schedule(static) 
    for(size_t i = 0; i < vertex_count; ++i){
        _vertexClusters[i] = structureAnalysis().atomCluster(int(i));
    }

    bool changed;
    do{
        changed = false;
        for(int idx = 0; idx < int(_vertexClusters.size()); ++idx){
            if(clusterOfVertex(idx)->id != 0) continue;

			for(auto* e = _vertexEdges[idx].first; e; e = e->nextLeavingEdge){
                if(clusterOfVertex(e->vertex2)->id != 0){
                    _vertexClusters[idx] = _vertexClusters[e->vertex2];
                    changed = true;
                    break;
                }
            }

            if(clusterOfVertex(idx)->id != 0) continue;

            for(auto* e = _vertexEdges[idx].second; e; e = e->nextArrivingEdge){
                if(clusterOfVertex(e->vertex1)->id != 0){
                    _vertexClusters[idx] = _vertexClusters[e->vertex1];
                    changed = true;
                    break;
                }
            }
        }
    }while(changed);

    return true;
}

bool ElasticMapping::assignIdealVectorsToEdges(bool reconstructEdgeVectors, int crystalPathSteps){
    CrystalPathFinder pathFinder{ structureAnalysis(), crystalPathSteps };

	for(auto const& [head, tail] : _vertexEdges){
        for(auto* edge = head; edge; edge = edge->nextLeavingEdge){
            if(edge->hasClusterVector()) continue;

            Cluster* c1 = clusterOfVertex(edge->vertex1);
            Cluster* c2 = clusterOfVertex(edge->vertex2);
            assert(c1 && c2);

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

    return true;
}

bool ElasticMapping::isElasticMappingCompatible(DelaunayTessellation::CellHandle cell) const{
    if(!tessellation().isValidCell(cell)) return false;

    std::array<std::pair<Vector3, ClusterTransition*>, 6> edgeVecs;
    for(int i = 0; i < 6; ++i){
        auto [vi, vj] = tetraEdgeVertices[i];
        int v1 = tessellation().vertexIndex(tessellation().cellVertex(cell, vi));
        int v2 = tessellation().vertexIndex(tessellation().cellVertex(cell, vj));
        auto* te = findEdge(v1, v2);

        if(!te || !te->hasClusterVector()){
            return false;
		}

        if(te->vertex1 == v1){
            edgeVecs[i] = { te->clusterVector, te->clusterTransition };
        }else{
            edgeVecs[i] = {
                te->clusterTransition->transform(-te->clusterVector),
                te->clusterTransition->reverse
            };
        }
    }

    static constexpr std::array<std::array<int, 3>, 4> circuits{{
        {{0, 4, 2}}, {{1, 5, 2}}, {{0, 3, 1}}, {{3, 5, 4}}
    }};

    for(auto const& c : circuits){
        Vector3 B = edgeVecs[c[0]].first
                  + edgeVecs[c[0]].second->reverseTransform(edgeVecs[c[1]].first)
                  - edgeVecs[c[2]].first;

        if(!B.isZero(CA_LATTICE_VECTOR_EPSILON)) return false;
    }

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

}
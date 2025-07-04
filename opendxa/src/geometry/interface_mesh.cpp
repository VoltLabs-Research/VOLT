#include <opendxa/geometry/interface_mesh.h>
#include <opendxa/analysis/dislocation_tracer.h>
#include <opendxa/geometry/manifold_construction_helper.h>
#include <algorithm>
#include <array>
#include <numeric>
#include <cassert>

namespace OpenDXA{

template<typename T>
auto most_common(std::span<const T> s) -> T{
    assert(!s.empty());
    T best = s[0];
	size_t bestCount = 1;
	size_t currentCount = 1;
	for(size_t i = 1; i < s.size(); ++i){
		if(s[i] == s[i - 1]){
			++currentCount;
		}else{
			if(currentCount > bestCount){
				bestCount = currentCount;
				best = s[i - 1];
			}
			currentCount = 1;
		}
	}

	if(currentCount > bestCount){
        best = s.back();
    }

    return best;
}

bool InterfaceMesh::createMesh(double maxNeighborDist, ParticleProperty* crystalClusters){
    _isCompletelyGood = true;
    _isCompletelyBad  = true;

    auto tetraRegion = [&](auto cell) -> unsigned {
        if(!elasticMapping().isElasticMappingCompatible(cell)){
			_isCompletelyGood = false;
			return 0;
		}

		_isCompletelyBad = false;
		if(crystalClusters){
			std::array<int, 4> cls;
			for(int vi = 0; vi < 4; ++vi){
				cls[vi] = crystalClusters->getInt(tessellation().vertexIndex(tessellation().cellVertex(cell, vi)));
			}

			std::ranges::sort(cls);
			return most_common(std::span<const int>{cls.data(), cls.size()}) + 1;
		}
		return 1;
    };

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
            e->physicalVector = pos[ni] - pos[i];
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
            std::tie(e->clusterVector, e->clusterTransition) = elasticMapping().getEdgeClusterVector(vIdx[i], vIdx[ni]);
            e = e->nextFaceEdge();
        }
    };

    double alpha = 5.0 * maxNeighborDist;
    ManifoldConstructionHelper<InterfaceMesh> helper{
        tessellation(),
        *this,
        alpha,
        structureAnalysis().positions()
    };

    if(!helper.construct(tetraRegion, prepareFace)){
        return false;
	}

    duplicateSharedVertices();

    return true;
}

bool InterfaceMesh::generateDefectMesh(
    DislocationTracer const& tracer,
    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex>& outMesh
){
    outMesh.reserveVertices(vertexCount());
    for(auto* v : vertices()){
        auto* nv = outMesh.createVertex(v->pos());
        assert(nv->index() == v->index());
    }

	std::vector<Face*> faceMap;
    faceMap.reserve(faces().size());

    for(auto* f : faces()){
        if(f->circuit && (f->testFlag(1) || !f->circuit->isDangling)){
            faceMap.push_back(nullptr);
            continue;
        }

        auto* nf = outMesh.createFace();
        faceMap.push_back(nf);

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

    for(auto* dn : tracer.danglingNodes()){
        auto* c = dn->circuit;
        assert(c && c->segmentMeshCap.size() >= 2);
        auto* capV = outMesh.createVertex(dn->position());
        for(auto* me : c->segmentMeshCap){
            assert(!faceMap[me->oppositeEdge()->face()->index()]);
            auto* v1 = outMesh.vertex(me->vertex2()->index());
            auto* v2 = outMesh.vertex(me->vertex1()->index());
            auto* nf = outMesh.createFace();
            outMesh.createEdge(v1, v2, nf);
            outMesh.createEdge(v2, capV, nf);
            outMesh.createEdge(capV, v1, nf);
        }
    }

    assert(outMesh.connectOppositeHalfedges());
    return true;
}

}
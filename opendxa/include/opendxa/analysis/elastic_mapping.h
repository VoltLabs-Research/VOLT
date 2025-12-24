#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/geometry/delaunay_tessellation.h>
#include <opendxa/utilities/memory_pool.h>
#include <opendxa/structures/cluster.h>
#include <opendxa/structures/cluster_graph.h>
#include <opendxa/analysis/structure_analysis.h>

namespace OpenDXA {

class ElasticMapping{
    struct TessellationEdge{
        int vertex1;
        int vertex2;
        Vector3 clusterVector{};
        ClusterTransition* clusterTransition = nullptr;
        TessellationEdge* nextLeavingEdge = nullptr;
        TessellationEdge* nextArrivingEdge = nullptr;

        TessellationEdge(int v1, int v2) noexcept : vertex1(v1), vertex2(v2){}

        [[nodiscard]] bool hasClusterVector() const noexcept{
			return clusterTransition != nullptr;
		}

        void assignClusterVector(Vector3 const& v, ClusterTransition* t) noexcept{
            clusterVector = v;
            clusterTransition = t;
        }

        void clearClusterVector() noexcept{
            clusterTransition = nullptr;
        }
    };

public:
    explicit ElasticMapping(StructureAnalysis& sa, DelaunayTessellation& tess) noexcept
        : _structureAnalysis(sa)
        , _tessellation(tess)
        , _clusterGraph(sa.clusterGraph())
        , _vertexEdges(sa.context().atomCount(), {nullptr, nullptr})
        , _vertexClusters(sa.context().atomCount(), nullptr){}

    [[nodiscard]] auto structureAnalysis() const noexcept -> StructureAnalysis& {
		return _structureAnalysis;
	}

    [[nodiscard]] auto tessellation() noexcept -> DelaunayTessellation& {
		return _tessellation;
	}

    [[nodiscard]] auto tessellation() const noexcept -> DelaunayTessellation const& {
		return _tessellation;
	}

    [[nodiscard]] auto clusterGraph() noexcept -> ClusterGraph& {
		return _clusterGraph;
	}

    [[nodiscard]] auto clusterGraph() const noexcept -> ClusterGraph const& {
		return _clusterGraph;
	}

	void generateTessellationEdges();
    void assignVerticesToClusters();
    void assignIdealVectorsToEdges(bool reconstructEdgeVectors, int crystalPathSteps);
    [[nodiscard]] auto isElasticMappingCompatible(DelaunayTessellation::CellHandle cell) const -> bool;
    void releaseCaches() noexcept;

    [[nodiscard]] auto clusterOfVertex(int idx) const noexcept -> Cluster*{
		assert(idx < (int)_vertexClusters.size());
		return _vertexClusters[idx];
	}

    [[nodiscard]] auto getEdgeClusterVector(int v1, int v2) const -> std::pair<Vector3, ClusterTransition*>{
        auto* e = findEdge(v1, v2);
        assert(e && e->hasClusterVector());
        if(e->vertex1 == v1){
            return { e->clusterVector, e->clusterTransition };
		}

		return {
			e->clusterTransition->transform(-e->clusterVector),
			e->clusterTransition->reverse
		};
    }

private:
    [[nodiscard]] auto edgeCount() const noexcept -> int {
		return _edgeCount;
	}

    [[nodiscard]] auto findEdge(int v1, int v2) const noexcept -> TessellationEdge* {
        assert(v1 >= 0 && v1 < static_cast<int>(_vertexEdges.size()));
        assert(v2 >= 0 && v2 < static_cast<int>(_vertexEdges.size()));

		for(auto* e = _vertexEdges[v1].first; e; e = e->nextLeavingEdge){
            if(e->vertex2 == v2) return e;
		}

		for(auto* e = _vertexEdges[v1].second; e; e = e->nextArrivingEdge){
            if(e->vertex1 == v2) return e;
		}

        return nullptr;
    }

private:
    StructureAnalysis& _structureAnalysis;
    DelaunayTessellation& _tessellation;
    ClusterGraph& _clusterGraph;

    MemoryPool<TessellationEdge> _edgePool{ 16'384 };
    int _edgeCount = 0;
    std::vector<std::pair<TessellationEdge*, TessellationEdge*>> _vertexEdges;
    std::vector<Cluster*> _vertexClusters;
};

}

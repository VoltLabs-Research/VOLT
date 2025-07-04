#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/cluster.h>
#include <opendxa/structures/cluster_graph.h>

namespace OpenDXA{

inline constexpr double CA_LATTICE_VECTOR_EPSILON = double(1e-3);
inline constexpr double CA_ATOM_VECTOR_EPSILON = double(1e-4);

class ClusterVector{
public:
	explicit ClusterVector(Vector3::Zero vec, Cluster* cluster = nullptr)
		: _vec(Vector3::Zero()), _cluster(cluster){}

	explicit ClusterVector(const Vector3& vec, Cluster* cluster)
		: _vec(vec), _cluster(cluster){}

	[[nodiscard]] const Vector3& localVec() const noexcept{
		return _vec;
	}
	
	[[nodiscard]] Vector3& localVec() noexcept{
		return _vec;
	}

	[[nodiscard]] Cluster* cluster() const noexcept{
		return _cluster;
	}

	[[nodiscard]] ClusterVector operator-() const{
		return ClusterVector(-_vec, _cluster);
	}

	[[nodiscard]] Vector3 toSpatialVector() const{
		assert(_cluster != nullptr);
		return _cluster->orientation * _vec;
	}

	[[nodiscard]] bool transformToCluster(Cluster* otherCluster, ClusterGraph& graph){
		assert(otherCluster);
		assert(_cluster);
		if(_cluster == otherCluster) return true;

		auto* transition = graph.determineClusterTransition(_cluster, otherCluster);
		if(!transition) return false;

		_vec = transition->tm * _vec;
		_cluster = otherCluster;
		return true;
	}
	
private:
	Vector3 _vec;
	Cluster* _cluster;
};

[[nodiscard]]
inline std::ostream& operator<<(std::ostream& stream, const ClusterVector& v){
	const int clusterId = v.cluster() ? v.cluster()->id : -1;
	return stream << v.localVec() << " [cluster " << clusterId << "]";
}

}
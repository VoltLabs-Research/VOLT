#ifndef OPENDXA_CLUSTER_VECTOR_HPP
#define OPENDXA_CLUSTER_VECTOR_HPP

#include <opendxa/includes.hpp>
#include <opendxa/structures/cluster/cluster.hpp>

#define CA_LATTICE_VECTOR_EPSILON FloatType(1e-6)
#define CA_ATOM_VECTOR_EPSILON FloatType(1e-4)

/**
 * A Cartesian vector in the stress-free reference configuration of a cluster.
 *
 * Each reference configuration vector is associated with a cluster,
 * which determines the local frame of reference the vector is expressed in.
 *
 * The only exception is the vector (0,0,0), which doesn't need to be associated
 * with a specific frame of reference.
*/
class ClusterVector{
public:
    ClusterVector(NullVector nullVector, Cluster* cluster = nullptr) : _vec(nullVector), _cluster(cluster){}
    explicit ClusterVector(const Vector3& vec, Cluster* cluster) : _vec(vec), _cluster(cluster){}

    const Vector3& localVec() const{
        return _vec;
    }

    Vector3& localVec(){
        return _vec;
    }

    Cluster* cluster() const{
        return _cluster;
    }

    ClusterVector operator-() const{
        return ClusterVector(-localVec(), cluster());
    }

    Vector3 toSpatialVector() const{
        DISLOCATIONS_ASSERT(cluster() != nullptr);
        return cluster()->transformation * localVec();
    }

private:
	// The XYZ components of the vector in the local lattice coordinate system.
    Vector3 _vec;

    // The cluster which serves as the frame of reference for this vector.
	// This may be NULL if the vector's components are (0,0,0).
    Cluster* _cluster;
};

#endif
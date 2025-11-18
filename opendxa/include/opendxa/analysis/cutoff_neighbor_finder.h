#ifndef CUTOFF_NEIGHBOR_FINDER_H
#define CUTOFF_NEIGHBOR_FINDER_H

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/math/lin_alg.h>

namespace OpenDXA{

class CutoffNeighborFinder{
private:
    // An internal per-particle data structure
    struct NeighborListParticle{
        // The position of the particle, wrapped at periodic boundaries
        Point3 pos;
        // The offset applied to the particle when wrapping it at periodic boundaries
        Vector_3<int8_t> pbcShift;
        // Pointer to next particle in linked list
        const NeighborListParticle* nextInBin;
    };

public:
    // Default constructor
    CutoffNeighborFinder(): _cutoffRadius(0), _cutoffRadiusSquared(0){}

    // Prepares the neighbor finder by sorting particles into a grid of a bin cells.
    bool prepare(double cutoffRadius, ParticleProperty* positions, const SimulationCell& simCell);

    // Returns the cutoff radius set via prepare()
    double cutoffRadius() const{
        return _cutoffRadius;
    }

    // Return the square of the cutoff radius set via prepare()
    double cutoffRadiusSquared() const{
        return _cutoffRadiusSquared;
    }

    // An iterator class that returns all neighbors of a central particle
    class Query{
    public:
        // Constructs a new neighbor query object that can be used to iterate over the neighbors of a particle.
        Query(const CutoffNeighborFinder& finder, size_t particleIndex);

        // Indicates wheter the end of the list of neighbors has been reached
        bool atEnd() const{
            return _atEnd;
        }

        // Finds the next neighbor particle within the cutoff radius.
        // Use atEnd() to test wheter another neighbor has been found.
        void next();

        // Returns the index of the current neighbor particle
        size_t current(){
            return _neighborIndex;
        }

        // Returns the vector connectin the central particle with the current neighbor
        const Vector3& delta() const{
            return _delta;
        }

        // Returns the distance squared between the central particle and the current neighbor
        double distanceSquared() const{
            return _distSq;
        }

        // Returns the PBC shift vector between the central particle and the current neighbor.
        // The vector is non-zero if the current neighbor vector crosses a periodic boundary.
		const Vector_3<int8_t>& pbcShift() const{
            return _pbcShift;
        }

        // Returns the PBC shift vector between the central particle and the current neighbor
        // as if the two particles were not wrapped at the periodic boundaries of the simulation cell.
        Vector_3<int8_t> unwrappedPbcShift() const {
			const auto& s1 = _builder.particles[_centerIndex].pbcShift;
			const auto& s2 = _builder.particles[_neighborIndex].pbcShift;
			return Vector_3<int8_t>(
					_pbcShift.x() - s1.x() + s2.x(),
					_pbcShift.y() - s1.y() + s2.y(),
					_pbcShift.z() - s1.z() + s2.z());
		}
    
    private:
        const CutoffNeighborFinder& _builder;
        bool _atEnd;
        Point3 _center, _shiftedCenter;
        size_t _centerIndex;
        std::vector<Vector3I>::const_iterator _stencilIter;
        Point3I _centerBin;
        Point3I _currentBin;
        const NeighborListParticle* _neighbor;
        size_t _neighborIndex;
        Vector_3<int8_t> _pbcShift;
        Vector3 _delta;
        double _distSq;
    };

private:
    // The neighbor criterion
    double _cutoffRadius;
    double _cutoffRadiusSquared;
    
    SimulationCell simCell;

    // Number of bins in each spatial direction
    int binDim[3];

    // Used to determine the bin from a particle position
    AffineTransformation reciprocalBinCell;

    // The internal list of particles
    std::vector<NeighborListParticle> particles;

    // An 3d array of cubic bins. Each bin is a linked list of particles.
    std::vector<const NeighborListParticle*> bins;

    // The list of adjacent cells to visit while finding
    // the neighbors of a central particle
	std::vector<Vector3I> stencil;
};

}

#endif
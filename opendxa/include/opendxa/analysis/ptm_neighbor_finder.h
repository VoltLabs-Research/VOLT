#pragma once

#include <opendxa/analysis/nearest_neighbor_finder.h>
#include <opendxa/analysis/polyhedral_template_matching.h>
#include <opendxa/analysis/analysis_context.h>
#include <boost/container/small_vector.hpp>

namespace OpenDXA{

// Finds the neighbors of a particle whose local crystalline order has been
// determined with the Polyhedral Template Matching Algorithm. 
class PTMNeighborFinder : public NearestNeighborFinder{
public:
    // Stores information about a single neighbor of the central particle
    struct Neighbor : NearestNeighborFinder::Neighbor{
        Vector3 idealVector;
        double disorientation;
    };

    PTMNeighborFinder(
        bool /*unused*/,
        std::shared_ptr<ParticleProperty> positions,
        std::shared_ptr<ParticleProperty> structures,
        std::shared_ptr<ParticleProperty> orientations,
        std::shared_ptr<ParticleProperty> correspondences,
        const SimulationCell& cell
    )
    : _structuresArray(std::move(structures))
    , _orientationsArray(std::move(orientations))
    , _correspondencesArray(std::move(correspondences))
    {
        this->prepare(positions.get(), cell, nullptr);
    }

    // Performs a PTM calculation on a single input particle.
    class Query{
    public:
        // The internal query type for finding the input set of nearest neighbors
        using NeighborQuery = NearestNeighborFinder::Query<PTM::MAX_INPUT_NEIGHBORS>;
        
        // Constructs a new kernel from the given neighbor finder, which must have peviously
        // been initialized by a call to PTMNeighborFinder::prepare().
        Query(const PTMNeighborFinder& finder) : _finder(finder){}

        // Computes the orderes list of neighbor particles for the given central particle
        void findNeighbors(size_t particleIndex, std::optional<Quaternion> _targetOrientation = {});
        
        // Returns the root-mean-square deviation calculated by the PTM for the current particle
        double interatomicDistance() const{
            return _interatomicDistance;
        }

        // Returns the local structure orientation computed by the PTM routine for the current particle
        const Quaternion& orientation() const{
            return _orientation;
        }

        // Returns the number of neighbors found for the current central particle
        int neighborCount() const{
            return _list.size();
        }

        const auto& neighbors() const { return _list; }
        StructureType structureType() const { return _structureType; }

    private:
        void getNeighbors(size_t particleIndex, int ptmType);
        void fillNeighbors(
            const NeighborQuery& neighborQuery, 
            size_t particleIndex, 
            int offset, 
            int num,
            const double *delta);

        void calculateRMSDScale();

        // Reference to the parent neighbor finder object
        const PTMNeighborFinder& _finder;
        // Local quantities computed by the PTM algorithm
        double _rmsd;
        double _interatomicDistance;
        StructureType _structureType;
        Quaternion _orientation;

        ptm_atomicenv_t _env;
        int _templateIndex = 0;

        boost::container::small_vector<Neighbor, PTM::MAX_INPUT_NEIGHBORS> _list;
    };

    std::shared_ptr<ParticleProperty> _structuresArray;
    std::shared_ptr<ParticleProperty> _orientationsArray;
    std::shared_ptr<ParticleProperty> _correspondencesArray;
};

}
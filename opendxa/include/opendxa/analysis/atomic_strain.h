#pragma once

#include <memory>
#include <vector>
#include <atomic>

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/core/particle_property.h>

namespace OpenDXA{

class CutoffNeighborFinder;

class AtomicStrainModifier{
public:
    class AtomicStrainEngine{
    public:
        AtomicStrainEngine(
            Particles::ParticleProperty* positions,
            const SimulationCell& cell,
            Particles::ParticleProperty* refPositions,
            const SimulationCell& refCell,
            Particles::ParticleProperty* identifiers,
            Particles::ParticleProperty* refIdentifiers,
            double cutoff,
            bool eliminateCellDeformation,
            bool assumeUnwrappedCoordinates,
            bool calculateDeformationGradients,
            bool calculateStrainTensors,
            bool calculateNonaffineSquaredDisplacements
        );

        void perform();

        std::shared_ptr<Particles::ParticleProperty> shearStrains() const{
            return _shearStrains;
        }

        std::shared_ptr<Particles::ParticleProperty> volumetricStrains() const{
            return _volumetricStrains;
        }

        std::shared_ptr<Particles::ParticleProperty> nonaffineSquaredDisplacements() const{
            return _nonaffineSquaredDisplacements;
        }

        std::shared_ptr<Particles::ParticleProperty> invalidParticles() const{
            return _invalidParticles;
        }

        std::shared_ptr<Particles::ParticleProperty> strainTensors() const{
            return _strainTensors;
        }

        std::shared_ptr<Particles::ParticleProperty> deformationGradients() const{
            return _deformationGradients;
        }

        std::size_t numInvalidParticles() const{
            return _numInvalidParticles.load(std::memory_order_relaxed);
        }

    private:
        Particles::ParticleProperty* positions() const{
            return _positions;
        }

        Particles::ParticleProperty* refPositions() const{
            return _refPositions;
        }

        Particles::ParticleProperty* identifiers() const{
            return _identifiers;
        }

        Particles::ParticleProperty* refIdentifiers() const{
            return _refIdentifiers;
        }

        const SimulationCell& refCell() const{
            return _simCellRef;
        }

        bool computeStrain(
            std::size_t particleIndex,
            CutoffNeighborFinder& neighborFinder,
            const std::vector<int>& refToCurrentIndexMap,
            const std::vector<int>& currentToRefIndexMap
        );

        Particles::ParticleProperty* _positions;
        Particles::ParticleProperty* _refPositions;
        Particles::ParticleProperty* _identifiers;
        Particles::ParticleProperty* _refIdentifiers;

        SimulationCell _simCell;
        SimulationCell _simCellRef; 

        AffineTransformation _currentSimCellInv;
        AffineTransformation _reducedToAbsolute;

        double _cutoff;
        bool _eliminateCellDeformation;
        bool _assumeUnwrappedCoordinates;
        bool _calculateDeformationGradients;
        bool _calculateStrainTensors;
        bool _calculateNonaffineSquaredDisplacements;

        std::shared_ptr<Particles::ParticleProperty> _shearStrains;
        std::shared_ptr<Particles::ParticleProperty> _volumetricStrains;
        std::shared_ptr<Particles::ParticleProperty> _nonaffineSquaredDisplacements;
        std::shared_ptr<Particles::ParticleProperty> _invalidParticles;
        std::shared_ptr<Particles::ParticleProperty> _strainTensors;
        std::shared_ptr<Particles::ParticleProperty> _deformationGradients;

        std::atomic<std::size_t> _numInvalidParticles{0};
    };
};

}
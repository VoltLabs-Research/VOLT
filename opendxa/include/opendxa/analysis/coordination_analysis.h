#pragma once

#include <opendxa/core/particle_property.h>
#include <opendxa/analysis/cutoff_neighbor_finder.h>

namespace OpenDXA{

class CoordinationNumber{
public:
    CoordinationNumber(){}

    // Returns the cutoff radius used to build the neighbor list for the analysis
    double cutoff() const{
        return _cutoff;
    }

    // Sets the cutoff radius used to build the neighbor lists for the analysis
    void setCutoff(double newCutoff){
        _cutoff = newCutoff;
    }

    // Returns the X coordinates of the RDF data points
    const std::vector<double>& rdfX() const{
        return _rdfX;
    }

    // Returns the Y coordinates of the RDF data points
    const std::vector<double>& rdY() const{
        return _rdfY;
    }

public:
    class CoordinationAnalysisEngine{
    public:
        CoordinationAnalysisEngine(ParticleProperty* positions, const SimulationCell& simCell, double cutoff, int rdfSampleCount)
            : _positions(positions),
            _simCell(simCell),
            _cutoff(cutoff),
            _rdfHistogram(rdfSampleCount, 0.0),
            _coordinationNumbers(new ParticleProperty(positions->size(), ParticleProperty::CoordinationProperty, 0, true)){}

        // Computes the modifier's result and stores them in this object for later retrieval
        void perform();

        // Returns the property storage that contain the input particle positions
        ParticleProperty* positions() const{
            return _positions;
        }

        // Returns the simulation cell data
        const SimulationCell& cell() const{
            return _simCell;
        }

        // Returns the property storage that contains the computed coordination numbers
        std::shared_ptr<ParticleProperty> coordinationNumbers() const{
            return _coordinationNumbers;
        }
        
        // Returns the cutoff radius
        double cutoff() const{
            return _cutoff;
        }

        // Returns the histogram for the radial distribution function
        const std::vector<double>& rdfHistogram() const{
            return _rdfHistogram;
        }
    
        double _cutoff;
        SimulationCell _simCell;
    
        ParticleProperty* _positions;
        std::shared_ptr<ParticleProperty> _coordinationNumbers;
        std::vector<double> _rdfHistogram;
    };

public:
    void transferComputationResults(CoordinationAnalysisEngine* engine);

private:
    // This stores the cached results of the modifier
    std::shared_ptr<ParticleProperty> _coordinationNumbers;

    // Controls the cutoff radius for the neighbor lists
    double _cutoff;

    // The X coordinates of the RDF data points
    std::vector<double> _rdfX;

    // The Y coordinates of the RDF data points
    std::vector<double> _rdfY;
};

}
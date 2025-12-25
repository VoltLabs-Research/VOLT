#include <opendxa/analysis/centrosymmetry.h>
#include <spdlog/spdlog.h>

#include <algorithm>
#include <numeric>
#include <cmath>
#include <stdexcept>
#include <mwm_csp.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

CentroSymmetryAnalysis::Engine::Engine(
    ParticleProperty* positions,
    const SimulationCell& cell,
    int numNeighbors,
    CSPMode mode
) : _positions(positions),
    _cell(cell),
    _k(numNeighbors),
    _mode(mode),
    _numBins(100),
    _histBinSize(1.0),
    _maxCSP(0.0)
{
    if(!_positions) throw std::runtime_error("CSP Engine: positions is null");
    if(_k < 2) throw std::runtime_error("CSP Engine: numNeighbors must be >= 2");
    if(_k > MAX_CSP_NEIGHBORS) throw std::runtime_error("CSP Engine: numNeighbors too large");
    if((_k % 2) != 0) throw std::runtime_error("CSP Engine: numNeighbors must be even");
}

void CentroSymmetryAnalysis::Engine::perform(){
    const size_t n = _positions->size();

    if(n == 0){
        _csp.reset();
        _histCounts.reset();
        _maxCSP = 0.0;
        _histBinSize = 1.0;
        return;
    }

    // Output CSP per particle
    _csp = std::make_shared<ParticleProperty>(n, DataType::Double, 1, 0, true);

    // Compute CSP per particle
    _maxCSP = 0.0;
    for(size_t i = 0; i < n; i++){
        computeParticleCSP(i);
        _maxCSP = std::max(_maxCSP, _csp->getDouble(i));
    }

    buildHistogram();
}

void CentroSymmetryAnalysis::Engine::computeParticleCSP(size_t i){
    std::vector<Neighbor> neigh;
    neigh.reserve((size_t) _k);
    
    findKNearest(i, neigh);

    if((int) neigh.size() < _k){
        _csp->setDouble(i, 0.0);
        return;
    }

    double csp = computeCSPFromNeighbors(neigh);
    if(!std::isfinite(csp) || csp < 0) csp = 0.0;

    _csp->setDouble(i, csp);
}

void CentroSymmetryAnalysis::Engine::findKNearest(size_t i, std::vector<Neighbor>& out) const{
    out.clear();

    const size_t n = _positions->size();
    const Point3* pos = _positions->constDataPoint3();
    const Point3 pi = pos[i];

    std::vector<Neighbor> all;
    all.reserve(n > 0 ? n - 1 : 0);
    for(size_t j = 0; j < n; j++){
        if(j == i) continue;

        Vector3 delta = _cell.wrapVector(pos[j] - pi);
        double d2 = (double) delta.squaredLength();

        if(d2 <= 0.0) continue;

        all.push_back(Neighbor{ d2, delta });
    }

    if(all.empty()) return;

    const size_t k = std::min<size_t>((size_t) _k, all.size());
    std::nth_element(all.begin(), all.begin() + (k - 1), all.end(), [](const Neighbor& a, const Neighbor& b){
        return a.dist2 < b.dist2;
    });

    all.resize(k);

    std::sort(all.begin(), all.end(), [](const Neighbor& a, const Neighbor& b){
        return a.dist2 < b.dist2;
    });

    out = std::move(all);
}

double CentroSymmetryAnalysis::Engine::computeCSPFromNeighbors(const std::vector<Neighbor>& neigh) const{
    const int numNN = (int) neigh.size();

    if(_mode == ConventionalMode){
        std::vector<double> pairs;
        pairs.reserve((size_t) numNN * (numNN - 1) / 2);

        for(int a = 0; a < numNN; a++){
            for(int b = a + 1; b < numNN; b++){
                Vector3 s = neigh[a].delta + neigh[b].delta;
                pairs.push_back((double) s.squaredLength());
            }
        }

        const int m = numNN / 2;
        if((int) pairs.size() < m) return 0.0;

        std::partial_sort(pairs.begin(), pairs.begin() + m, pairs.end());

        double csp = std::accumulate(pairs.begin(), pairs.begin() + m, 0.0);
        return csp;
    }else{
        // MatchingMode (MWM CSP)
        static_assert(MAX_CSP_NEIGHBORS <= MWM_CSP_MAX_POINTS, "CSP neighbor limit mismatch");
        double P[MAX_CSP_NEIGHBORS][3];
        for(int i = 0; i < numNN; i++){
            P[i][0] = (double)neigh[i].delta.x();
            P[i][1] = (double)neigh[i].delta.y();
            P[i][2] = (double)neigh[i].delta.z();
        }

        return (double)calculate_mwm_csp(numNN, P);
    }
}

void CentroSymmetryAnalysis::Engine::buildHistogram(){
    _histBinSize = (_maxCSP > 0.0) ? (1.01 * _maxCSP / (double)_numBins) : 0.0;
    if(_histBinSize <= 0.0) _histBinSize = 1.0;

    _histCounts = std::make_shared<ParticleProperty>(_numBins, DataType::Int64, 1, 0, true);
    for(size_t i = 0; i < _numBins; i++){
        _histCounts->setInt64(i, 0);
    }

    const size_t n = _positions->size();
    for(size_t i = 0; i < n; i++){
        const double v = _csp->getDouble(i);
        int bin = (int)(v / _histBinSize);
        if(bin < 0) bin = 0;
        if(bin >= (int)_numBins) continue;
        _histCounts->setInt64((size_t)bin, _histCounts->getInt64((size_t)bin) + 1);
    }
}


}
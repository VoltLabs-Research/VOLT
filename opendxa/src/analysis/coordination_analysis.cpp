#include <opendxa/analysis/coordination_analysis.h>

namespace OpenDXA{

// Performs the actual computation. 
void CoordinationNumber::CoordinationAnalysisEngine::perform(){
    // Prepare the neighbor list
    CutoffNeighborFinder neighborListBuilder;
    if(!neighborListBuilder.prepare(_cutoff, positions(), cell())){
        return;
    }

    size_t particleCount = positions()->size();

    // Perform analysis on each particle in parallel
    std::vector<std::thread> workers;
    int numThreads = std::max(1, (int)std::thread::hardware_concurrency());
    size_t chunkSize = particleCount / numThreads;
    size_t startIndex = 0;
    size_t endIndex = chunkSize;
    std::mutex mutex;

    for(int t = 0; t < numThreads; t++){
        if(t == numThreads - 1){
            endIndex += particleCount % numThreads;
        }
        workers.push_back(std::thread([&neighborListBuilder, startIndex, endIndex, &mutex, this](){
            int* coordOutput = _coordinationNumbers->dataInt();
            double rdfBinSize = (_cutoff + EPSILON) / _rdfHistogram.size();
            std::vector<size_t> threadLocalRDF(_rdfHistogram.size(), 0);
            for(size_t i = startIndex; i < endIndex;){
                int coordNumber = 0;
                for(CutoffNeighborFinder::Query neighQuery(neighborListBuilder, i); !neighQuery.atEnd(); neighQuery.next()){
                    coordNumber++;
                    size_t rdfInterval = (size_t)(sqrt(neighQuery.distanceSquared()) / rdfBinSize);
                    threadLocalRDF[rdfInterval]++;
                }
                coordOutput[i] = coordNumber;
                i++;
            }
            std::lock_guard<std::mutex> lock(mutex);
            auto iter_out = _rdfHistogram.begin();
            for(auto iter = threadLocalRDF.cbegin(); iter != threadLocalRDF.cend(); ++iter, ++iter_out){
                *iter_out += *iter;
            }
        }));
        startIndex = endIndex;
        endIndex += chunkSize;
    }
    for(auto &t : workers) t.join();
}

// Unpacks the result of the computation engine and stores them in the modifier
void CoordinationNumber::transferComputationResults(CoordinationAnalysisEngine* engine){
    CoordinationAnalysisEngine* eng = static_cast<CoordinationAnalysisEngine*>(engine);
    _coordinationNumbers = eng->coordinationNumbers();

    const auto& hist = eng->rdfHistogram();

    _rdfY.resize(hist.size());
    _rdfX.resize(hist.size());

    double rho = static_cast<double>(eng->positions()->size()) / eng->cell().volume3D();
    double constant = 4.0 / 3.0 * M_PI * rho * eng->positions()->size();
    double stepSize = eng->cutoff() / _rdfX.size();

    for(size_t i = 0; i < _rdfX.size(); i++){
        double r  = stepSize * i;
        double r2 = r + stepSize;
        _rdfX[i] = r + 0.5 * stepSize;
        _rdfY[i] = hist[i] / (constant * (r2 * r2 * r2 - r * r * r));
    }
}
}
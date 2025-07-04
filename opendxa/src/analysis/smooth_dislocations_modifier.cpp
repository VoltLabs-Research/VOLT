#include <opendxa/core/opendxa.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/analysis/smooth_dislocations_modifier.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <algorithm>
#include <numeric>
#include <cassert>
#include <omp.h>

namespace OpenDXA{

static constexpr double k_PB = 0.1f;
static constexpr double lambda_def = 0.5f;
static constexpr double tol_closed = 1e-4f;

SmoothDislocationsModifier::SmoothDislocationsModifier() noexcept = default;

inline void computeLaplacian(
    std::vector<Vector3>& lap,
    const std::deque<Point3>& line,
    bool isLoop
){
    const size_t n = line.size();
    for(size_t i = 0; i < n; ++i){
        size_t im = (i + n - 1) % n;
        size_t ip = (i + 1) % n;
        lap[i] = ((line[im] - line[i]) + (line[ip] - line[i])) * double(0.5);
    }

    if(!isLoop){
        lap.front().setZero();
        lap.back().setZero();
    }
}

inline void applySmoothingPass(
    std::deque<Point3>& line,
    const std::vector<Vector3>& lap,
    double weight
){
    const size_t n = line.size();
    for(size_t i = 0; i < n; ++i){
        line[i] += weight * lap[i];
    }
}

void SmoothDislocationsModifier::smoothDislocationLines(DislocationNetwork* dislocationNetwork){
    if(_coarseningEnabled || _smoothingEnabled){
        const auto& segments = dislocationNetwork->segments();
        
        // Paralelizar el procesamiento de segmentos de dislocación
        #pragma omp parallel for schedule(dynamic)
        for(size_t seg_idx = 0; seg_idx < segments.size(); ++seg_idx){
            DislocationSegment* segment = segments[seg_idx];
            if(segment->coreSize.empty() || segment->line.size() < 2) continue;

            std::deque<Point3> line;
            std::deque<int>   coreSize;
            coarsenDislocationLine(
                _coarseningEnabled ? _linePointInterval : 0,
                segment->line,
                segment->coreSize,
                line,
                coreSize,
                segment->isClosedLoop(),
                segment->isInfiniteLine()
            );

            smoothDislocationLine(
                _smoothingEnabled ? _smoothingLevel : 0,
                line,
                segment->isClosedLoop()
            );

            segment->line = std::move(line);
            segment->coreSize.clear();
        }
    }
}

void SmoothDislocationsModifier::coarsenDislocationLine(
    double linePointInterval,
    const std::deque<Point3>& input,
    const std::deque<int>& coreSize,
    std::deque<Point3>& output,
    std::deque<int>& outputCoreSize,
    bool isClosedLoop,
    bool isInfiniteLine
){
    assert(input.size() >= 2);
    assert(input.size() == coreSize.size());

    if(linePointInterval <= 0){
        output = input;
        outputCoreSize = coreSize;
        return;
    }

    if(isInfiniteLine && input.size() >= 3){
        int sumCore = std::accumulate(coreSize.cbegin(), coreSize.cend() - 1, 0);
        int cnt = int(input.size()) - 1;
        if(sumCore * linePointInterval > cnt * cnt){
            Vector3 com = Vector3::Zero();
            for(auto it = input.cbegin(); it != input.cend() - 1; ++it){
                com += *it - input.front();
            }

            output.push_back(input.front() + com / cnt);
            outputCoreSize.push_back(sumCore / cnt);
            output.push_back(input.back() + com / cnt);
            outputCoreSize.push_back(sumCore / cnt);
            return;
        }
    }

    if(input.size() < 4){
        output = input;
        outputCoreSize = coreSize;
        return;
    }

    if(!isClosedLoop){
        output.push_back(input.front());
        outputCoreSize.push_back(coreSize.front());
    }

    int minNumPoints = 2;
    if(input.front().equals(input.back(), double(1e-4))){
        minNumPoints = 4;
    }

    auto it = input.cbegin();
    auto itCore = coreSize.cbegin();
    int sum = 0, cnt = 0;
    Vector3 com  = Vector3::Zero();

    do{
        sum += *itCore;
        com += *it - input.front();
        ++cnt; ++it; ++itCore;
    }while(2 * cnt * cnt < int(linePointInterval * sum) && cnt + 1 < int(input.size()) / minNumPoints / 2);

    auto itEnd = input.cend() - 1;
    auto itCoreEnd = coreSize.cend() - 1;
    while(cnt * cnt < int(linePointInterval * sum) && cnt < int(input.size()) / minNumPoints){
        sum += *itCoreEnd;
        com += *itEnd - input.back();
        
        ++cnt; 
        --itEnd; 
        --itCoreEnd;
    }

    if(isClosedLoop){
        output.push_back(input.front() + com / cnt);
        outputCoreSize.push_back(sum / cnt);
    }

    while(it < itEnd){
        int sum2 = 0, cnt2 = 0;
        Vector3 com2 = Vector3::Zero();

        do{
            sum2 += *itCore++;
            com2.x() += it->x();
            com2.y() += it->y();
            com2.z() += it->z();
            ++cnt2; 
            ++it;
        }while(
            cnt2 * cnt2 < int(linePointInterval * sum2)
            && cnt2 < int(input.size())/minNumPoints - 1
            && it != itEnd);

        output.push_back(Point3::Origin() + com2 / cnt2);
        outputCoreSize.push_back(sum2 / cnt2);
    }

    if(!isClosedLoop){
        output.push_back(input.back());
        outputCoreSize.push_back(coreSize.back());
    }else{
        output.push_back(input.back() + com / cnt);
        outputCoreSize.push_back(sum / cnt);
    }

    assert(output.size() >= minNumPoints);
    assert(!isClosedLoop || isInfiniteLine || output.size() >= 3);
}

void SmoothDislocationsModifier::smoothDislocationLine(
    int smoothingLevel,
    std::deque<Point3>& line,
    bool isLoop
){
    if(smoothingLevel <= 0 || line.size() <= 2){
        return;
    }

    if(line.size() <= 4 && line.front().equals(line.back(), tol_closed)){
        return;
    }

    double lambda = lambda_def;
    double mu = 1.0f / (k_PB - 1.0f / lambda);
    double pref[2] = { lambda, mu };

    std::vector<Vector3> lap(line.size());
    for(int iter = 0; iter < smoothingLevel; ++iter){
        for(int pass = 0; pass < 2; ++pass){
            computeLaplacian(lap, line, isLoop);
            applySmoothingPass(line, lap, pref[pass]);
        }
    }
}

}
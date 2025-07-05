#pragma once

#include <omp.h>
#include <vector>
#include <algorithm>
#include <numeric>
#include <future>
#include <memory>
#include <chrono>
#include <thread>
#include <iostream>
#include <string>

namespace OpenDXA{

class PerfomanceProfiler{
private:
    std::string operationName;
    std::chrono::high_resolution_clock::time_point startTime;

public:
    PerfomanceProfiler(const std::string &name) : operationName(name){
        startTime = std::chrono::high_resolution_clock::now();
    }

    ~PerfomanceProfiler(){
        auto endTime = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);
        std::cout << "[PROFILE] " << operationName << " took " << duration.count() << " ms" << std::endl;
    }
};

class ParallelSystem{
public:
    static void initialize(){
        const int maxThreads = std::thread::hardware_concurrency();
        omp_set_num_threads(maxThreads);
        omp_set_dynamic(0);
        omp_set_nested(1);
    }

    template <typename IndexType, typename Function>
    static void parallelFor(IndexType count, Function &&func){
        if(count <= 0) return;
        #pragma omp parallel
        {
            #pragma omp for schedule(static)
            for(IndexType i = 0; i < count; ++i){
                func(i);
            }
        }
    }

    static int getNumThreads(){
        return omp_get_max_threads();
    }
};

#define PROFILE(name) OpenDXA::PerfomanceProfiler _prof(name)

}
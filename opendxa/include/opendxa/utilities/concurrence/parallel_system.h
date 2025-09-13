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
        spdlog::debug("[PROFILE] {} took {} ms", operationName, duration.count());
    }
};

#define PROFILE(name) OpenDXA::PerfomanceProfiler _prof(name)

}
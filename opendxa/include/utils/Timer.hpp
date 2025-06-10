#ifndef __DXA_TIMER_H
#define __DXA_TIMER_H

#include "../Includes.hpp"
#include <chrono>

class Timer{
public:
	Timer(){
		startTime = std::chrono::high_resolution_clock::now();
	}

	FloatType elapsedTime() const{
		auto currentTime = std::chrono::high_resolution_clock::now();
		auto duration = std::chrono::duration_cast<std::chrono::microseconds>(currentTime - startTime);
		// Convert to seconds
		return static_cast<FloatType>(duration.count()) / 1000000.0;
	}

	FloatType elapsedMilliseconds() const{
		auto currentTime = std::chrono::high_resolution_clock::now();
		auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(currentTime - startTime);
		return static_cast<FloatType>(duration.count());
	}

	FloatType elapsedMicroseconds() const{
		auto currentTime = std::chrono::high_resolution_clock::now();
		auto duration = std::chrono::duration_cast<std::chrono::microseconds>(currentTime - startTime);
		return static_cast<FloatType>(duration.count());
	}

	void reset(){
		startTime = std::chrono::high_resolution_clock::now();
	}

private:
	std::chrono::high_resolution_clock::time_point startTime;
};

#endif
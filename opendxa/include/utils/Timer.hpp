#ifndef __DXA_TIMER_H
#define __DXA_TIMER_H

#include "../Includes.hpp"

class Timer{
public:
	Timer() { ::time(&startTime); }
	FloatType elapsedTime() const {
		return (FloatType)(::time(NULL) - startTime);
	}

private:

	time_t startTime;
};

#endif
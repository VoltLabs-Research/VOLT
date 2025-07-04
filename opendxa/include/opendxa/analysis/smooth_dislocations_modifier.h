#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/structures/dislocation_network.h>
#include <opendxa/math/lin_alg.h>
#include <deque>
#include <vector>

namespace OpenDXA{

class SmoothDislocationsModifier{
public:
    SmoothDislocationsModifier() noexcept;

	void smoothDislocationLines(DislocationNetwork* network);

	[[nodiscard]] bool smoothingEnabled() const noexcept{
		return _smoothingEnabled;
	}

	void setSmoothingEnabled(bool enable) noexcept{
		_smoothingEnabled = enable; 
	}

	[[nodiscard]] int smoothingLevel() const noexcept{
		return _smoothingLevel;
	}

	void setSmoothingLevel(int level) noexcept{
		_smoothingLevel = level;
	}

    [[nodiscard]] bool coarseningEnabled() const noexcept{
		return _coarseningEnabled;
	}

    void setCoarseningEnabled(bool enable) noexcept{
		_coarseningEnabled = enable;
	}

	[[nodiscard]] double linePointInterval() const noexcept{
		return _linePointInterval;
	}

    void setLinePointInterval(double d) noexcept{
		_linePointInterval = d;
	}

protected:
	void coarsenDislocationLine(
		double interval,
        std::deque<Point3> const& input,
        std::deque<int> const& coreSize,
        std::deque<Point3>& output,
        std::deque<int>& outputCoreSize,
        bool isClosedLoop,
        bool isInfiniteLine);
	
    void smoothDislocationLine(
        int level,
        std::deque<Point3>& line,
        bool isLoop);

private:
	bool _smoothingEnabled = false;
	int _smoothingLevel = 0;
	bool _coarseningEnabled = false;
	double _linePointInterval = 0.0;
};

}
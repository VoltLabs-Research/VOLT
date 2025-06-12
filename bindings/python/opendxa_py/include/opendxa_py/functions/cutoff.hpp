#ifndef OPENDXA_PYTHON_CUTOFF_FUNCTIONS_HPP
#define OPENDXA_PYTHON_CUTOFF_FUNCTIONS_HPP

#include <vector>
#include <array>

namespace OpenDXA::Bindings::Python::Wrappers{

double estimateCutoffFromPositions(
    const std::vector<std::array<double, 3>>& positions,
    const std::array<std::array<double, 3>, 3>& cell
);

}

#endif
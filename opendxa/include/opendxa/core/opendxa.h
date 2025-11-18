#pragma once

#include <iostream>
#include <cmath>
#include <cstdint>
#include <cstddef>
#include <type_traits>
#include <stack>
#include <array>
#include <vector>
#include <map>
#include <unordered_map>
#include <set>
#include <utility>
#include <random>
#include <memory>
#include <mutex>
#include <thread>
#include <clocale>
#include <atomic>
#include <tuple>
#include <numeric>
#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_sinks.h>

inline constexpr double EPSILON = 1e-12;
inline constexpr double DOUBLE_MAX = std::numeric_limits<double>::max();
inline constexpr double PI = std::numbers::pi_v<double>;

#include <boost/dynamic_bitset.hpp>
#include <opendxa/math/lin_alg.h>

namespace OpenDXA::Particles{
	class ParticlePropertyObject;
	class ParticleTypeProperty;
	class ParticleProperty;
	class ParticleType;
	class BondsStorage;
	class BondsObject;
	class BondPropertyObject;
	class BondTypeProperty;
	class BondProperty;
	class BondType;
	class VectorDisplay;
	class SurfaceMesh;
	class SimulationCell;
	class SimulationCellObject;
}

namespace OpenDXA{
	using namespace OpenDXA::Particles;

	class NearestNeighborFinder;
	class StructurePattern;
	class BurgersVectorFamily;
	class PatternCatalog;
	class DislocationDisplay;
	class ClusterGraph;
	class DislocationNetwork;
	class PartitionMesh;
	struct DislocationNode;
	struct DislocationSegment;
}
#include "../Includes.hpp"

namespace OpenDXA{
struct Config{
	// Required
	double cnaCutoff;
	std::string inputFile;
	std::string outputFile;

	// Dump-related
	std::string dumpMeshFile;
	std::string dumpAtomsFile;
    std::string dumpSFPlanesFile;
    std::string dumpSurfaceFile;
    std::string dumpSurfaceCapFile;
    std::string dumpCellFile;

	// Control
	bool pbcX = false;
	bool pbcY = false;
	bool pbcZ = false;

	Vector3 atomOffset{0, 0, 0};
	Vector3 scaleFactors{1, 1, 1};

	// Circuits & Smoothing
	int maxCircuitSize = DEFAULT_MAX_BURGERS_CIRCUIT_SIZE;
	int extendedCircuitSize = DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE;
	int surfaceSmooth = DEFAULT_SURFACE_SMOOTHING_LEVEL;
	int lineSmooth = DEFAULT_LINE_SMOOTHING_LEVEL;
	int lineCoarsen = DEFAULT_LINE_COARSENING_LEVEL;
	FloatType sfFlatten = DEFAULT_SF_FLATTEN_LEVEL;
};
}
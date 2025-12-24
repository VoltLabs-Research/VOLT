#include <opendxa/cli/common.h>
#include <opendxa/analyzers/atomic_strain.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Atomic Strain Analysis");
    std::cerr
        << "  --cutoff <float>              Cutoff radius for neighbor search. [default: 3.0]\n"
        << "  --reference <file>            Reference LAMMPS dump file.\n"
        << "                                If omitted, current frame is used (≈ zero strain).\n"
        << "  --eliminateCellDeformation    Eliminate cell deformation. [default: false]\n"
        << "  --assumeUnwrapped             Assume unwrapped coordinates. [default: false]\n"
        << "  --calcDeformationGradient     Compute deformation gradient F. [default: true]\n"
        << "  --calcStrainTensors           Compute strain tensors. [default: true]\n"
        << "  --calcD2min                   Compute D²min (nonaffine displacement). [default: true]\n"
        << "  --threads <int>               Max worker threads (TBB/OMP). [default: auto]\n"
        << "  --deterministic <bool>        Force single-threaded deterministic run. [default: false]\n";
    printHelpOption();
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        showUsage(argv[0]);
        return 1;
    }
    
    std::string filename, outputBase;
    auto opts = parseArgs(argc, argv, filename, outputBase);
    
    if (hasOption(opts, "--help") || filename.empty()) {
        showUsage(argv[0]);
        return filename.empty() ? 1 : 0;
    }
    
    auto parallel = initParallelism(opts, false);
    initLogging("opendxa-atomic-strain", parallel.threads, parallel.deterministic);
    
    LammpsParser::Frame frame;
    if (!parseFrame(filename, frame)) return 1;
    
    // Parse reference frame if provided
    std::string refFile = getString(opts, "--reference");
    LammpsParser::Frame refFrame;
    bool hasReference = false;
    
    if (!refFile.empty()) {
        spdlog::info("Parsing reference file: {}", refFile);
        LammpsParser refParser;
        if (!refParser.parseFile(refFile, refFrame)) {
            spdlog::error("Failed to parse reference file: {}", refFile);
            return 1;
        }
        if (refFrame.natoms != frame.natoms) {
            spdlog::error("Atom count mismatch: current={} reference={}", frame.natoms, refFrame.natoms);
            return 1;
        }
        hasReference = true;
        spdlog::info("Reference loaded: {} atoms", refFrame.natoms);
    }
    
    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);
    
    AtomicStrainAnalyzer analyzer;
    analyzer.setCutoff(getDouble(opts, "--cutoff", 3.0));
    
    if (hasReference) {
        analyzer.setReferenceFrame(refFrame);
    }
    
    analyzer.setOptions(
        getBool(opts, "--eliminateCellDeformation", false),
        getBool(opts, "--assumeUnwrapped", false),
        getBool(opts, "--calcDeformationGradient", true),
        getBool(opts, "--calcStrainTensors", true),
        getBool(opts, "--calcD2min", true)
    );
    
    spdlog::info("Starting atomic strain analysis...");
    json result = analyzer.compute(frame, outputBase);
    
    if (result.value("is_failed", false)) {
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    
    spdlog::info("Atomic strain analysis completed.");
    return 0;
}

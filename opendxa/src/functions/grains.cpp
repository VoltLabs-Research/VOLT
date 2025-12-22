#include <opendxa/cli/common.h>
#include <opendxa/analyzers/grain_segmentation.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Grain Segmentation");
    std::cerr
        << "  --rmsd <float>                        RMSD threshold for PTM. [default: 0.1]\n"
        << "  --minGrainAtomCount <int>             Minimum atoms per grain. [default: 100]\n"
        << "  --adoptOrphanAtoms <true|false>       Adopt orphan atoms. [default: true]\n"
        << "  --handleCoherentInterfaces <true|false> Handle coherent interfaces. [default: true]\n"
        << "  --outputBonds                         Output neighbor bonds. [default: false]\n";
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
    
    initLogging("grain-segmentation");
    
    LammpsParser::Frame frame;
    if (!parseFrame(filename, frame)) return 1;
    
    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);
    
    bool adoptOrphanAtoms = getString(opts, "--adoptOrphanAtoms", "true") == "true";
    int minGrainAtomCount = getInt(opts, "--minGrainAtomCount", 100);
    bool handleCoherentInterfaces = getString(opts, "--handleCoherentInterfaces", "true") == "true";
    bool outputBonds = hasOption(opts, "--outputBonds");
    
    spdlog::info("Grain segmentation parameters:");
    spdlog::info("  - adoptOrphanAtoms: {}", adoptOrphanAtoms);
    spdlog::info("  - minGrainAtomCount: {}", minGrainAtomCount);
    spdlog::info("  - handleCoherentInterfaces: {}", handleCoherentInterfaces);
    spdlog::info("  - outputBonds: {}", outputBonds);
    
    GrainSegmentationAnalyzer analyzer;
    analyzer.setIdentificationMode(StructureAnalysis::Mode::PTM);
    analyzer.setRMSD(getDouble(opts, "--rmsd", 0.1f));
    analyzer.setParameters(
        adoptOrphanAtoms,
        minGrainAtomCount,
        handleCoherentInterfaces,
        outputBonds
    );
    
    spdlog::info("Starting grain segmentation...");
    json result = analyzer.compute(frame, outputBase);
    
    if (result.value("is_failed", false)) {
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    return 0;
}

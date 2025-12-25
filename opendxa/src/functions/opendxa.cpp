#include <opendxa/cli/common.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Full Dislocation Analysis");
    std::cerr
        << "  --crystalStructure <type>         Reference crystal structure. (BCC|FCC|HCP|CUBIC_DIAMOND|HEX_DIAMOND|SC) [default: BCC]\n"
        << "  --identificationMode <mode>       Structure identification mode. (CNA|PTM|DIAMOND) [default: CNA]\n"
        << "  --rmsd <float>                    RMSD threshold for PTM. [default: 0.1]\n"
        << "  --maxTrialCircuitSize <int>       Maximum Burgers circuit size. [default: 14]\n"
        << "  --circuitStretchability <int>     Circuit stretchability factor. [default: 9]\n"
        << "  --lineSmoothingLevel <float>      Line smoothing level. [default: 1]\n"
        << "  --linePointInterval <float>       Point interval on dislocation lines. [default: 2.5]\n"
        << "  --onlyPerfectDislocations <bool>  Detect only perfect dislocations. [default: false]\n"
        << "  --markCoreAtoms <bool>            Mark dislocation core atoms. [default: false]\n"
        << "  --threads <int>                   Max worker threads (TBB/OMP). [default: 1]\n";
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
    
    auto parallel = initParallelism(opts, true);
    initLogging("opendxa-dxa", parallel.threads);
    
    LammpsParser::Frame frame;
    if (!parseFrame(filename, frame)) return 1;
    
    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);
    
    DislocationAnalysis analyzer;
    
    analyzer.setInputCrystalStructure(parseCrystalStructure(getString(opts, "--crystalStructure", "BCC")));
    analyzer.setIdentificationMode(parseIdentificationMode(getString(opts, "--identificationMode", "CNA")));
    analyzer.setRmsd(getDouble(opts, "--rmsd", 0.1f));
    analyzer.setMaxTrialCircuitSize(getInt(opts, "--maxTrialCircuitSize", 14));
    analyzer.setCircuitStretchability(getInt(opts, "--circuitStretchability", 9));
    analyzer.setLineSmoothingLevel(getDouble(opts, "--lineSmoothingLevel", 1.0));
    analyzer.setLinePointInterval(getDouble(opts, "--linePointInterval", 2.5));
    analyzer.setOnlyPerfectDislocations(getBool(opts, "--onlyPerfectDislocations"));
    analyzer.setMarkCoreAtoms(getBool(opts, "--markCoreAtoms"));
    
    spdlog::info("Starting dislocation analysis...");
    json result = analyzer.compute(frame, outputBase);
    
    if (result.value("is_failed", false)) {
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    
    spdlog::info("Analysis completed successfully.");
    return 0;
}

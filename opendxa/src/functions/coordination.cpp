#include <opendxa/cli/common.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Coordination Analysis");
    std::cerr
        << "  --cutoff <float>    Cutoff radius for coordination analysis. [default: 3.5]\n"
        << "  --bins <int>        Number of RDF bins. [default: 100]\n";
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
    
    initLogging("opendxa-coordination");
    
    LammpsParser::Frame frame;
    if (!parseFrame(filename, frame)) return 1;
    
    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);
    
    DislocationAnalysis analyzer;
    analyzer.setCoordinationAnalysisOnly(true);
    analyzer.setCoordinationCutoff(getDouble(opts, "--cutoff", 3.5));
    analyzer.setCoordinationRdfBins(getInt(opts, "--bins", 100));
    
    spdlog::info("Starting coordination analysis...");
    json result = analyzer.compute(frame, outputBase);
    
    if (result.value("is_failed", false)) {
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    
    spdlog::info("Coordination analysis completed.");
    return 0;
}

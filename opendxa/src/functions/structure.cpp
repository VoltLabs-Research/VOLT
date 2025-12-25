#include <opendxa/cli/common.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Structure Identification");
    std::cerr
        << "  --mode <mode>     Identification mode. (CNA|PTM|DIAMOND) [default: CNA]\n"
        << "  --rmsd <float>    RMSD threshold for PTM. [default: 0.1]\n"
        << "  --threads <int>   Max worker threads (TBB/OMP). [default: auto]\n";
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
    initLogging("opendxa-structure", parallel.threads);
    
    LammpsParser::Frame frame;
    if (!parseFrame(filename, frame)) return 1;
    
    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);
    
    DislocationAnalysis analyzer;
    analyzer.setStructureIdentificationOnly(true);
    analyzer.setIdentificationMode(parseIdentificationMode(getString(opts, "--mode", "CNA")));
    analyzer.setRmsd(getDouble(opts, "--rmsd", 0.1f));
    
    spdlog::info("Starting structure identification...");
    json result = analyzer.compute(frame, outputBase);
    
    if (result.value("is_failed", false)) {
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    
    spdlog::info("Structure identification completed.");
    return 0;
}

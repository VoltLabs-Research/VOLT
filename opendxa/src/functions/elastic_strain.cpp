#include <opendxa/cli/common.h>
#include <opendxa/analyzers/elastic_strain.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

void showUsage(const std::string& name) {
    printUsageHeader(name, "OpenDXA - Elastic Strain Analysis");
    std::cerr
        << "  --crystalStructure <type>     Crystal structure. (BCC|FCC|HCP|...) [default: BCC]\n"
        << "  --latticeConstant <float>     Lattice constant a₀. [required]\n"
        << "  --caRatio <float>             c/a ratio for HCP/hex crystals. [default: 1.0]\n"
        << "  --pushForward                 Push to spatial frame (Euler strain). [default: false]\n"
        << "  --calcDeformationGradient     Compute deformation gradient F. [default: true]\n"
        << "  --calcStrainTensors           Compute strain tensors. [default: true]\n"
        << "  --identificationMode <mode>   Structure identification mode (CNA|PTM). [default: PTM]\n"
        << "  --rmsd <float>                RMSD cutoff for PTM. [default: 0.10]\n"
        << "  --threads <int>               Max worker threads (TBB/OMP). [default: auto]\n";
    printHelpOption();
}

int main(int argc, char* argv[]){
    if(argc < 2){
        showUsage(argv[0]);
        return 1;
    }

    std::string filename, outputBase;
    auto opts = parseArgs(argc, argv, filename, outputBase);

    if(hasOption(opts, "--help") || filename.empty()){
        showUsage(argv[0]);
        return filename.empty() ? 1 : 0;
    }

    if(!hasOption(opts, "--latticeConstant")){
        spdlog::error("--latticeConstant is required for elastic strain analysis.");
        showUsage(argv[0]);
        return 1;
    }

    auto parallel = initParallelism(opts, false);
    initLogging("opendxa-elastic-strain", parallel.threads);

    LammpsParser::Frame frame;
    if(!parseFrame(filename, frame)) return 1;

    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);

    ElasticStrainAnalyzer analyzer;
    analyzer.setInputCrystalStructure(parseCrystalStructure(getString(opts, "--crystalStructure", "BCC")));
    analyzer.setParameters(
        getDouble(opts, "--latticeConstant", 1.63),
        getDouble(opts, "--caRatio", 1.0),
        getBool(opts, "--pushForward", false),
        getBool(opts, "--calcDeformationGradient", true),
        getBool(opts, "--calcStrainTensors", true)
    );

    std::string modeStr = getString(opts, "--identificationMode", "PTM");
    if(modeStr == "CNA"){
        analyzer.setIdentificationMode(StructureAnalysis::Mode::CNA);
    }else if(modeStr == "PTM"){
        analyzer.setIdentificationMode(StructureAnalysis::Mode::PTM);
    }else{
        spdlog::warn("Unknown identification mode '{}', defaulting to PTM.", modeStr);
        analyzer.setIdentificationMode(StructureAnalysis::Mode::PTM);
    }

    analyzer.setRMSD(getDouble(opts, "--rmsd", 0.10));
    spdlog::info("Starting elastic strain analysis...");
    json result = analyzer.compute(frame, outputBase);

    if(result.value("is_failed", false)){
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }
    
    spdlog::info("Elastic strain analysis completed.");
    return 0;
}

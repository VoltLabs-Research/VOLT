#include <opendxa/cli/common.h>
#include <opendxa/analyzers/compute_displacements.h>

using namespace OpenDXA;
using namespace OpenDXA::CLI;

static void showUsage(const std::string& name){
    printUsageHeader(name, "OpenDXA - Displacements Analysis");
    std::cerr
        << "  --reference <file>            Reference LAMMPS dump file.\n"
        << "                                If omitted, current frame is used (≈ zero displacement).\n"
        << "  --mic                         Use minimum image convention. [default: true]\n"
        << "  --affineMapping <mode>        Affine mapping mode: noMapping|toReferenceCell|toCurrentCell [default: noMapping]\n"
        << "  --threads <int>               Max worker threads (TBB/OMP). [default: auto]\n";
    printHelpOption();
}

static ComputeDisplacements::AffineMappingType parseAffineMapping(const std::string& s){
    if(s == "noMapping") return ComputeDisplacements::AffineMappingType::NoMapping;
    if(s == "toReferenceCell") return ComputeDisplacements::AffineMappingType::ToReferenceCell;
    if(s == "toCurrentCell") return ComputeDisplacements::AffineMappingType::ToCurrentCell;

    spdlog::warn("Unknown affineMapping '{}', defaulting to 'none'.", s);
    return ComputeDisplacements::AffineMappingType::NoMapping;
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

    auto parallel = initParallelism(opts, false);
    initLogging("opendxa-displacements", parallel.threads);

    LammpsParser::Frame frame;
    if(!parseFrame(filename, frame)) return 1;

    // Parse reference frame if provided
    std::string refFile = getString(opts, "--reference");
    LammpsParser::Frame refFrame;
    bool hasReference = false;

    if(!refFile.empty()){
        spdlog::info("Parsing reference file: {}", refFile);
        LammpsParser refParser;
        if(!refParser.parseFile(refFile, refFrame)){
            spdlog::error("Failed to parse reference file: {}", refFile);
            return 1;
        }
        if(refFrame.natoms != frame.natoms){
            spdlog::error("Atom count mismatch: current={} reference={}", frame.natoms, refFrame.natoms);
            return 1;
        }
        hasReference = true;
        spdlog::info("Reference loaded: {} atoms", refFrame.natoms);
    }

    outputBase = deriveOutputBase(filename, outputBase);
    spdlog::info("Output base: {}", outputBase);

    // Options
    bool mic = getBool(opts, "--mic", true);
    auto affineMapping = parseAffineMapping(getString(opts, "--affineMapping", "none"));

    DisplacementsAnalyzer analyzer;
    analyzer.setOptions(mic, affineMapping);

    if(hasReference){
        analyzer.setReferenceFrame(refFrame);
    }

    spdlog::info("Starting displacements analysis...");
    json result = analyzer.compute(frame, outputBase);

    if(result.value("is_failed", false)){
        spdlog::error("Analysis failed: {}", result.value("error", "Unknown error"));
        return 1;
    }

    spdlog::info("Displacements analysis completed.");
    return 0;
}
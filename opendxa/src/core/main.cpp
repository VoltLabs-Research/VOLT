#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/grain_segmentation.h>
#include <opendxa/core/lammps_parser.h>

#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include <tbb/info.h>
#include <iomanip>
#include <nlohmann/json.hpp>
#include <map>
#include <memory>

#include <spdlog/spdlog.h>
#include <spdlog/sinks/stdout_sinks.h>

using json = nlohmann::json;

void show_usage(const std::string& name){
    std::cerr << "Usage: " << name << " <lammps_file> [output_base]\n\n"
              << "Arguments:\n"
              << "  <lammps_file>              Path to the LAMMPS dump file to be analyzed.\n"
              << "  [output_base]              Optional. The base path and name for the output JSON files.\n"
              << "                             If not provided, it's derived from the input file name.\n\n"
              << "Options:\n"
              << "  --crystalStructure <type>  Reference crystal structure type. Default: BCC.\n"
              << "                             Available types: BCC, FCC, HCP, CUBIC_DIAMOND, HEX_DIAMOND, SC.\n\n"
              << "  --identificationMode <mode> Structure identification mode. Default: CNA.\n"
              << "                             Available modes: CNA, PTM, DIAMOND.\n\n"
              << "  --rmsd <float>             If identification mode is PTM. RMSD should be specified.\n\n"
              << "  --structureIdentificationOnly <bool>  Only generates an output file with the structure identification.\n\n"
              << "  --grainSegmentationOnly <bool>        Only performs grain segmentation analysis and exports GLB model.\n\n"
              << "  --maxTrialCircuitSize <int>           Maximum size of the Burgers circuit. Default: 14.\n\n"
              << "  --circuitStretchability <int>         Circuit stretchability factor. Default: 9.\n\n"
              << "  --lineSmoothingLevel <lvl>            Line smoothing level. Default: 1.\n\n"
              << "  --linePointInterval <dist>            Distance between points on dislocation lines. Default: 2.5.\n\n"
              << "  --onlyPerfectDislocations <bool>      Detect only perfect dislocations(true/false). Default: false.\n\n"
              << "  --markCoreAtoms <bool>                Mark atoms belonging to the dislocation core(true/false). Default: false.\n\n"
              << "  --coordinationAnalysis <bool>         Run only coordination analysis (true/false).\n"
              << "  --cordinationCutoff <float>           Cutoff radius for coordination analysis.\n"
              << "  --coordinationBins <int>              Number of RDF bins for coordination analysis.\n\n"
              << "  --atomicStrainEnabled <bool>          Enable atomic strain inside DXA (true/false).\n"
              << "  --atomicStrainCutoff <float>          Cutoff radius for atomic strain. Default: 3.0.\n"
              << "  --referenceSource <file>              LAMMPS dump to use as reference configuration for atomic strain.\n"
              << "                                        If omitted, the current frame is used as reference (≈ zero strain).\n"
              << "  --atomicStrainEliminateCellDeformation <bool>   Eliminate cell deformation (default: false).\n"
              << "  --atomicStrainAssumeUnwrapped <bool>            Assume unwrapped coords (default: false).\n"
              << "  --atomicStrainCalcDeformationGradient <bool>    Compute deformation gradient F (default: true).\n"
              << "  --atomicStrainCalcStrainTensors <bool>          Compute strain tensor (default: true).\n"
              << "  --atomicStrainCalcD2min <bool>                  Compute nonaffine squared disp. D2min (default: true).\n\n"
              << "  --elasticStrainEnabled <bool>            Enable elastic strain analysis (true/false).\n"
              << "  --elasticLatticeConstant <float>        Lattice constant a0 for elastic strain.\n"
              << "  --elasticCaRatio <float>                c/a ratio for non-cubic crystals.\n"
              << "  --elasticPushForward <bool>             Push strain tensors to spatial frame (Euler strain).\n"
              << "  --elasticCalcDeformationGradient <bool> Compute deformation gradient F.\n"
              << "  --elasticCalcStrainTensors <bool>       Compute strain tensors.\n\n"

              << "  --help                                Show this help message and exit.\n"
              << std::endl;
}

int main(int argc, char* argv[]){
    if(argc < 2){
        show_usage(argv[0]);
        return 1;
    }

    int n = oneapi::tbb::info::default_concurrency();
    spdlog::info("Using {} threads (OneTBB)", n);

    std::string filename;
    std::string output_base;
    std::string referenceSource;
    std::map<std::string, std::string> options;

    for(int i = 1; i < argc; ++i){
        std::string arg = argv[i];
        if(arg.rfind("--", 0) == 0){
            if(arg == "--help"){
                show_usage(argv[0]);
                return 0;
            }
            if(i + 1 < argc){
                if(arg == "--referenceSource"){
                    referenceSource = argv[++i];
                }else{
                    options[arg] = argv[++i];
                }
            }else{
                std::cerr << "Error: Option " << arg << " requires a value." << std::endl;
                return 1;
            }
        }else if(filename.empty()){
            filename = arg;
        }else if(output_base.empty()){
            output_base = arg;
        }
    }
    
    if(filename.empty()){
        std::cerr << "Error: A LAMMPS input file is required." << std::endl;
        show_usage(argv[0]);
        return 1;
    }

    auto console_sink = std::make_shared<spdlog::sinks::stdout_sink_mt>();
    console_sink->set_level(spdlog::level::debug);
    auto logger = std::make_shared<spdlog::logger>("OpenDXA-CLI", console_sink);
    logger->set_level(spdlog::level::debug);
    spdlog::set_default_logger(logger);
    spdlog::flush_on(spdlog::level::debug);
    spdlog::set_pattern("[%Y-%m-%d %H:%M:%S] [%l] %v");
    
    spdlog::info("Parsing LAMMPS file: {}", filename);
    OpenDXA::LammpsParser parser;
    OpenDXA::LammpsParser::Frame frame;
    if(!parser.parseFile(filename, frame)){
        spdlog::error("Failed to parse LAMMPS file: {}", filename);
        return 1;
    }
    spdlog::info("Successfully loaded {} atoms from the file.", frame.natoms);

    OpenDXA::LammpsParser::Frame refFrame;
    bool hasExternalReference = !referenceSource.empty();

    if(hasExternalReference){
        spdlog::info("Parsing reference LAMMPS file for atomic strain: {}", referenceSource);
        OpenDXA::LammpsParser refParser;
        if(!refParser.parseFile(referenceSource, refFrame)){
            spdlog::error("Failed to parse reference LAMMPS file: {}", referenceSource);
            return 1;
        }
        spdlog::info("Successfully loaded {} atoms from the reference file.", refFrame.natoms);

        if(refFrame.natoms != frame.natoms){
            spdlog::error("Current and reference frames have different atom counts ({} vs {}).",
                          frame.natoms, refFrame.natoms);
            return 1;
        }
    }

    OpenDXA::DislocationAnalysis analyzer;

    try{
        if(options.count("--crystalStructure")){
            std::string val = options["--crystalStructure"];
            if(val == "BCC")      analyzer.setInputCrystalStructure(OpenDXA::LATTICE_BCC);
            else if(val == "FCC") analyzer.setInputCrystalStructure(OpenDXA::LATTICE_FCC);
            else if(val == "HCP") analyzer.setInputCrystalStructure(OpenDXA::LATTICE_HCP);
            else if(val == "CUBIC_DIAMOND") analyzer.setInputCrystalStructure(OpenDXA::LATTICE_CUBIC_DIAMOND);
            else if(val == "HEX_DIAMOND")   analyzer.setInputCrystalStructure(OpenDXA::LATTICE_HEX_DIAMOND);
            else if(val == "SC")            analyzer.setInputCrystalStructure(OpenDXA::LATTICE_SC);
            else{
                spdlog::error("Unknown crystal structure '{}' specified.", val);
                show_usage(argv[0]);
                return 1;
            }
        }

        if(options.count("--atomicStrainEnabled")){
            analyzer.enableAtomicStrain(options["--atomicStrainEnabled"] == "true");
        }
        if(options.count("--atomicStrainCutoff")){
            analyzer.setAtomicStrainCutoff(std::stod(options["--atomicStrainCutoff"]));
        }
        if(hasExternalReference){
            analyzer.setAtomicStrainReferenceFrame(refFrame);
        }

        bool eliminateCellDeformation       = false;
        bool assumeUnwrappedCoordinates     = false;
        bool calcDefGradAtomic              = true;
        bool calcStrainTensorsAtomic        = true;
        bool calcD2min                      = true;

        if(options.count("--atomicStrainEliminateCellDeformation")){
            eliminateCellDeformation = (options["--atomicStrainEliminateCellDeformation"] == "true");
        }
        if(options.count("--atomicStrainAssumeUnwrapped")){
            assumeUnwrappedCoordinates = (options["--atomicStrainAssumeUnwrapped"] == "true");
        }
        if(options.count("--atomicStrainCalcDeformationGradient")){
            calcDefGradAtomic = (options["--atomicStrainCalcDeformationGradient"] == "true");
        }
        if(options.count("--atomicStrainCalcStrainTensors")){
            calcStrainTensorsAtomic = (options["--atomicStrainCalcStrainTensors"] == "true");
        }
        if(options.count("--atomicStrainCalcD2min")){
            calcD2min = (options["--atomicStrainCalcD2min"] == "true");
        }

        analyzer.setAtomicStrainOptions(
            eliminateCellDeformation,
            assumeUnwrappedCoordinates,
            calcDefGradAtomic,
            calcStrainTensorsAtomic,
            calcD2min
        );

        bool elasticEnabled = false;
        double elasticLatticeConstant = 1.0;
        double elasticCaRatio = 1.0;
        bool elasticPushForward = false;
        bool elasticCalcDefGrad = true;
        bool elasticCalcStrainTensors = true;

        if(options.count("--elasticStrainEnabled")){
            elasticEnabled = (options["--elasticStrainEnabled"] == "true");
        }
        if(options.count("--elasticLatticeConstant")){
            elasticLatticeConstant = std::stod(options["--elasticLatticeConstant"]);
        }
        if(options.count("--elasticCaRatio")){
            elasticCaRatio = std::stod(options["--elasticCaRatio"]);
        }
        if(options.count("--elasticPushForward")){
            elasticPushForward = (options["--elasticPushForward"] == "true");
        }
        if(options.count("--elasticCalcDeformationGradient")){
            elasticCalcDefGrad = (options["--elasticCalcDeformationGradient"] == "true");
        }
        if(options.count("--elasticCalcStrainTensors")){
            elasticCalcStrainTensors = (options["--elasticCalcStrainTensors"] == "true");
        }

        analyzer.enableElasticStrain(elasticEnabled);
        analyzer.setElasticStrainParameters(
            elasticLatticeConstant,
            elasticCaRatio,
            elasticPushForward,
            elasticCalcDefGrad,
            elasticCalcStrainTensors
        );

        if(options.count("--identificationMode")){
            std::string val = options["--identificationMode"];
            if(val == "CNA")      analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::CNA);
            else if(val == "PTM") analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::PTM);
            else if(val == "DIAMOND") analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::DIAMOND);
        }
        if(options.count("--coordinationAnalysis")){
            analyzer.setCoordinationAnalysisOnly(options["--coordinationAnalysis"] == "true");
        }
        if(options.count("--cordinationCutoff")){
            analyzer.setCoordinationCutoff(std::stod(options["--cordinationCutoff"]));
        }
        if(options.count("--coordinationBins")){
            analyzer.setCoordinationRdfBins(std::stoi(options["--coordinationBins"]));
        }
        if(options.count("--rmsd")){
            analyzer.setRmsd(std::stod(options["--rmsd"]));
        }
        if(options.count("--structureIdentificationOnly")){
            analyzer.setStructureIdentificationOnly(options["--structureIdentificationOnly"] == "true");
        }
        if(options.count("--grainSegmentationOnly")){
            analyzer.setGrainSegmentationOnly(options["--grainSegmentationOnly"] == "true");
        }
        if(options.count("--maxTrialCircuitSize")){
            analyzer.setMaxTrialCircuitSize(std::stod(options["--maxTrialCircuitSize"]));
        }
        if(options.count("--circuitStretchability")){
            analyzer.setCircuitStretchability(std::stod(options["--circuitStretchability"]));
        }
        if(options.count("--onlyPerfectDislocations")){
            analyzer.setOnlyPerfectDislocations(options["--onlyPerfectDislocations"] == "true");
        }
        if(options.count("--lineSmoothingLevel")){
            analyzer.setLineSmoothingLevel(std::stod(options["--lineSmoothingLevel"]));
        }
        if(options.count("--linePointInterval")){
            analyzer.setLinePointInterval(std::stod(options["--linePointInterval"]));
        }
        if(options.count("--markCoreAtoms")){
            analyzer.setMarkCoreAtoms(options["--markCoreAtoms"] == "true");
        }
    }catch(const std::exception& e){
        spdlog::error("Error while processing options: {}", e.what());
        return 1;
    }
    
    std::string outputFilenameBase;
    if(!output_base.empty()){
        outputFilenameBase = output_base;
    }else{
        std::filesystem::path inputPath(filename);
        outputFilenameBase = (inputPath.parent_path() / inputPath.stem()).string();
    }
    spdlog::info("Using output base name: {}", outputFilenameBase);

    spdlog::info("Starting dislocation analysis...");
    json result = analyzer.compute(frame, outputFilenameBase);
    
    if(result.value("is_failed", false)){
        spdlog::error("DXA analysis failed.");
        if(result.contains("error")){
            spdlog::error("Reason: {}", result["error"].get<std::string>());
        }
        return 1;
    }

    spdlog::info("Analysis completed successfully.");
    return 0;
}

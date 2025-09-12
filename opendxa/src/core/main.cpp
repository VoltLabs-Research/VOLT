#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <nlohmann/json.hpp>
#include <map>

using json = nlohmann::json;

void show_usage(const std::string& name){
    std::cerr << "Usage: " << name << " <lammps_file> [output_base]\n\n"
              << "Arguments:\n"
              << "  <lammps_file> Path to the LAMMPS dump file to be analyzed.\n"
              << "  [output_base]              Optional. The base path and name for the output JSON files.\n"
              << "                             If not provided, it's derived from the input file name.\n\n"
              << "Options:\n"
              << "  --crystalStructure <type>  Reference crystal structure type. Default: BCC.\n"
              << "                             Available types: BCC, FCC, HCP, CUBIC_DIAMOND, HEX_DIAMOND.\n\n"
              << "  --identificationMode <mode> Structure identification mode. Default: CNA.\n"
              << "                             Available modes: CNA, PTM, DIAMOND.\n\n"
              << "  --rmsd <float> If identification mode is PTM. RMSD Should be specified.\n\n"
              << "  --structureIdentificationOnly Only generates a output file with the structure identification.\n\n"
              << "  --maxTrialCircuitSize <int> Maximum size of the Burgers circuit. Default: 14.\n\n"
              << "  --circuitStretchability <int> Circuit stretchability factor. Default: 9.\n\n"
              << "  --lineSmoothingLevel <lvl>  Line smoothing level. Default: 1.\n\n"
              << "  --linePointInterval <dist>  Distance between points on dislocation lines. Default: 2.5.\n\n"
              << "  --onlyPerfectDislocations <bool> Detect only perfect dislocations(true/false). Default: false.\n\n"
              << "  --markCoreAtoms <bool>      Mark atoms belonging to the dislocation core(true/false). Default: false.\n\n"
              << "  --help                     Show this help message and exit.\n"
              << std::endl;
}

int main(int argc, char* argv[]){
    if(argc < 2){
        show_usage(argv[0]);
        return 1;
    }

    std::string filename;
    std::string output_base;
    std::map<std::string, std::string> options;

    for(int i = 1; i < argc; ++i){
        std::string arg = argv[i];
        if(arg.rfind("--", 0)==  0){
            if(arg == "--help"){
                show_usage(argv[0]);
                return 0;
            }
            if(i + 1 < argc){
                options[arg] = argv[++i];
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
    
    spdlog::info("Parsing LAMMPS file:{}", filename);
    OpenDXA::LammpsParser parser;
    OpenDXA::LammpsParser::Frame frame;
    if(!parser.parseFile(filename, frame)){
        spdlog::error("Failed to parse LAMMPS file:{}", filename);
        return 1;
    }
    spdlog::info("Successfully loaded {} atoms from the file.", frame.natoms);

    OpenDXA::DislocationAnalysis analyzer;

    try{
        if(options.count("--crystalStructure")){
            std::string val = options["--crystalStructure"];
            if(val == "BCC")analyzer.setInputCrystalStructure(OpenDXA::LATTICE_BCC);
            else if(val == "FCC")analyzer.setInputCrystalStructure(OpenDXA::LATTICE_FCC);
            else if(val == "HCP")analyzer.setInputCrystalStructure(OpenDXA::LATTICE_HCP);
            else if(val == "CUBIC_DIAMOND")analyzer.setInputCrystalStructure(OpenDXA::LATTICE_CUBIC_DIAMOND);
            else if(val == "HEX_DIAMOND")analyzer.setInputCrystalStructure(OpenDXA::LATTICE_HEX_DIAMOND);
            else if(val == "SC") analyzer.setInputCrystalStructure(OpenDXA::LATTICE_SC);
            else{
                 spdlog::error("Unknown crystal structure '{}' specified.", val);
                 show_usage(argv[0]);
                 return 1;
            }
        }
        if(options.count("--identificationMode")){
            std::string val = options["--identificationMode"];
            if(val == "CNA")analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::CNA);
            else if(val == "PTM")analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::PTM);
            else if(val == "DIAMOND") analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::DIAMOND);
        }
        if(options.count("--rmsd")){
            analyzer.setRmsd(std::stod(options["--rmsd"]));
        }
        if(options.count("--structureIdentificationOnly")){
            analyzer.setStructureIdentificationOnly(options["--structureIdentificationOnly"] == "true");
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
        outputFilenameBase =(inputPath.parent_path()/ inputPath.stem()).string();
    }
    spdlog::info("Using output base name:{}", outputFilenameBase);

    spdlog::info("Starting dislocation analysis...");
    json result = analyzer.compute(frame, outputFilenameBase);
    
    if(result.value("is_failed", false)){
        spdlog::error("DXA analysis failed.");
        if(result.contains("error")){
            spdlog::error("Reason:{}", result["error"].get<std::string>());
        }
        return 1;
    }

    spdlog::info("Analysis completed successfully.");
    return 0;
}
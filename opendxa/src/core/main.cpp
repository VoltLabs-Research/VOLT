#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

int main(int argc, char* argv[]){
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <lammps_file> [output_json]" << std::endl;
        return 1;
    }
    
    std::string filename = argv[1];
    std::string jsonOutput = (argc >= 3) ? argv[2] : "";
    
    OpenDXA::LatticeStructureType structure = OpenDXA::LATTICE_BCC;
    int circuitSize = 14;
    int elongation = 9;
    bool perfectOnly = false;

    OpenDXA::LammpsParser parser;
    OpenDXA::LammpsParser::Frame frame;

    if(!parser.parseFile(filename, frame)){
        std::cerr << "Error: Failed to parse LAMMPS file" << std::endl;
        return 1;
    }

    std::cout << "Parsed " << frame.natoms << " atoms at timestep " << frame.timestep << std::endl;

    OpenDXA::DislocationAnalysis analyzer;
    analyzer.setInputCrystalStructure(structure);
    analyzer.setMaxTrialCircuitSize(circuitSize);
    analyzer.setCircuitStretchability(elongation);
    analyzer.setOnlyPerfectDislocations(perfectOnly);
    analyzer.setIdentificationMode(OpenDXA::StructureAnalysis::Mode::CNA);

    std::string outputFile;
    if(!jsonOutput.empty()){
        outputFile = jsonOutput;
    }else{
        std::filesystem::path inputPath(filename);
        outputFile = inputPath.stem().string() + "_dxa_results.json";
    }
    
    json result = analyzer.compute(frame, outputFile);
    
    if(result["is_failed"]){
        std::cerr << "Error: DXA analysis failed" << std::endl;
        return 1;
    }

    return 0;
}
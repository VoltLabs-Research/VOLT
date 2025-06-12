#include <opendxa/parser/parser_stream.hpp>
#include <opendxa/utils/timer.hpp>
#include <opendxa/core/stacking_faults.hpp>
#include <opendxa/logger/logger.hpp>
#include <opendxa/engine/config.hpp>
#include <cxxopts.hpp>

static OpenDXA::Config parseOptions(int argc, char* argv[]){
	cxxopts::Options opts("OpenDXA", "Dislocation Extraction Algorithm (DXA)");
	opts.add_options()
		("cna_cutoff", "Common Neighbor Analysis (CNA) cutoff radius", cxxopts::value<double>())
		("inputfile", "Input atom file", cxxopts::value<std::string>())
		("outputfile", "Output VTK file", cxxopts::value<std::string>())
		("dumpjsonfile", "Output JSON file", cxxopts::value<std::string>())
		("dumpmesh", "Dump interface mesh", cxxopts::value<std::string>())
		("dumpatoms", "Dump processed atoms", cxxopts::value<std::string>())
		("dumpsf", "Dump SF planes", cxxopts::value<std::string>())
		("dumpsurface", "Dump defect surface", cxxopts::value<std::string>())
		("dumpsurfacecap", "Dump PBC cap surface", cxxopts::value<std::string>())
		("dumpcell", "Dump simulation cell geometry", cxxopts::value<std::string>())
		("pbc", "Periodic BC (X Y Z)", cxxopts::value<std::vector<int>>())
		("offset", "Atom offset (X Y Z)", cxxopts::value<std::vector<double>>())
		("scale", "Cell scale (X Y Z)", cxxopts::value<std::vector<double>>())
		("maxcircuitsize", "Max burgers circuit", cxxopts::value<int>()->default_value(std::to_string(DEFAULT_MAX_BURGERS_CIRCUIT_SIZE)))
		("extcircuitsize", "Max extended circuit", cxxopts::value<int>()->default_value(std::to_string(DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE)))
		("smoothsurface", "Surface smooth level", cxxopts::value<int>()->default_value(std::to_string(DEFAULT_SURFACE_SMOOTHING_LEVEL)))
		("smoothlines", "Line smooth level", cxxopts::value<int>()->default_value(std::to_string(DEFAULT_LINE_SMOOTHING_LEVEL)))
		("coarsenlines", "Line coarsen level", cxxopts::value<int>()->default_value(std::to_string(DEFAULT_LINE_COARSENING_LEVEL)))
		("flattensf", "SF flatten level", cxxopts::value<FloatType>()->default_value(std::to_string(DEFAULT_SF_FLATTEN_LEVEL)))
		("help", "Print help");
	
	// Required args
	opts.parse_positional({ "inputfile", "outputfile" });
	auto result = opts.parse(argc, argv);
	if(result.count("help")){
		std::cout << opts.help() << std::endl;
		std::exit(0);
	}

	OpenDXA::Config config;
    config.inputFile = result["inputfile"].as<std::string>();
    config.outputFile = result["outputfile"].as<std::string>();
	
	if(result.count("dumpjsonfile")) config.dumpJsonFile = result["dumpjsonfile"].as<string>();
	if(result.count("cna_cutoff")) config.cnaCutoff = result["cna_cutoff"].as<double>();
	if(result.count("dumpmesh")) config.dumpMeshFile = result["dumpmesh"].as<std::string>();
	if(result.count("dumpatoms")) config.dumpAtomsFile = result["dumpatoms"].as<std::string>();
	if(result.count("dumpsf")) config.dumpSFPlanesFile = result["dumpsf"].as<std::string>();
	if(result.count("dumpsurface")) config.dumpSurfaceFile = result["dumpsurface"].as<std::string>();
	if(result.count("dumpsurfacecap")) config.dumpSurfaceCapFile = result["dumpsurfacecap"].as<std::string>();
	if(result.count("dumpcell")) config.dumpCellFile = result["dumpcell"].as<std::string>();

	if(result.count("pbc")){
		auto vec = result["pbc"].as<std::vector<int>>();
		config.pbcX = vec[0];
		config.pbcY = vec[1];
		config.pbcZ = vec[2];
	}

	if(result.count("offset")){
		auto vec = result["offset"].as<std::vector<double>>();
		config.atomOffset = { vec[0], vec[1], vec[2] };
	}

	if(result.count("scale")){
		auto vec = result["scale"].as<std::vector<double>>();
		config.scaleFactors = { vec[0], vec[1], vec[2] };
	}

    config.maxCircuitSize = result["maxcircuitsize"].as<int>();
    config.extendedCircuitSize = result["extcircuitsize"].as<int>();
    config.surfaceSmooth = result["smoothsurface"].as<int>();
    config.lineSmooth = result["smoothlines"].as<int>();
    config.lineCoarsen = result["coarsenlines"].as<int>();
    config.sfFlatten = result["flattensf"].as<FloatType>();
    return config;
}

int main(int argc, char* argv[]){
	try{
		auto logger = std::make_shared<Logger>("Global");
		logger->setLevel(LogLevel::INFO);
		LoggerManager::initialize(logger);

		OpenDXA::Config config = parseOptions(argc, argv);
		DXAStackingFaults searcher;
		searcher.compute(config);
		
	}catch(std::exception &exception){
		std::cerr << "Error: " << exception.what() << std::endl;
		return 1;
	}

	return 0;
}
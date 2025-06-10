#include "parser/ParserStream.hpp"
#include "utils/Timer.hpp"
#include "core/StackingFaults.hpp"
#include "engine/Config.hpp"
#include "cxxopts.hpp"

static OpenDXA::Config parseOptions(int argc, char* argv[]){
	cxxopts::Options opts("OpenDXA", "Dislocation Extraction Algorithm (DXA)");
	opts.add_options()
		("cna_cutoff", "Common Neighbor Analysis (CNA) cutoff radius", cxxopts::value<double>())
		("inputfile", "Input atom file", cxxopts::value<std::string>())
		("outputfile", "Output VTK file", cxxopts::value<std::string>())
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
	opts.parse_positional({ "cna_cutoff", "inputfile", "outputfile" });
	auto result = opts.parse(argc, argv);
	if(result.count("help") || !result.count("cna_cutoff")){
		std::cout << opts.help() << std::endl;
		std::exit(0);
	}

	OpenDXA::Config config;
	config.cnaCutoff = result["cna_cutoff"].as<double>();
    config.inputFile = result["inputfile"].as<std::string>();
    config.outputFile = result["outputfile"].as<std::string>();
	
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

static void runDislocationAnalysis(const OpenDXA::Config &config){
	DXAStackingFaults searcher(std::cerr, std::cerr);
	searcher.setCNACutoff((FloatType) config.cnaCutoff);
	searcher.setPBC(config.pbcX, config.pbcY, config.pbcZ);
	searcher.setMaximumBurgersCircuitSize(config.maxCircuitSize);
	searcher.setMaximumExtendedBurgersCircuitSize(config.extendedCircuitSize);

	std::ifstream inputFile(config.inputFile);
	if(!inputFile){
		throw std::runtime_error("Cannot open " + config.inputFile);
	}

	ParserStream parserStream(inputFile);
	searcher.readAtomsFile(parserStream);

	if(config.scaleFactors != Vector3{1, 1, 1}){
		searcher.transformSimulationCell(Matrix3(config.scaleFactors.X, 0, 0, 0, config.scaleFactors.Y, 0, 0, 0, config.scaleFactors.Z));
	}

	searcher.wrapInputAtoms(config.atomOffset);

	Timer fullTimer;
	searcher.buildNearestNeighborLists();
	searcher.performCNA();
	searcher.orderCrystallineAtoms();
	searcher.clusterAtoms();
	searcher.createInterfaceMeshNodes();

	if(!config.dumpSFPlanesFile.empty()) searcher.createStackingFaultEdges();
	if(!config.dumpAtomsFile.empty()) searcher.writeAtomsDumpFile(*new std::ofstream(config.dumpAtomsFile));

	searcher.createInterfaceMeshFacets();
	searcher.validateInterfaceMesh();
	searcher.findStackingFaultPlanes();
	searcher.traceDislocationSegments();

	if(!config.dumpMeshFile.empty()) searcher.writeInterfaceMeshFile(*new std::ofstream(config.dumpMeshFile));
	if(!config.dumpSurfaceFile.empty()){
		searcher.generateOutputMesh();
		searcher.smoothOutputSurface(config.surfaceSmooth);
		searcher.writeOutputMeshFile(*new std::ofstream(config.dumpSurfaceFile));
	}

	searcher.smoothDislocationSegments(config.lineSmooth, config.lineCoarsen);
	searcher.finishStackingFaults(config.sfFlatten);
	searcher.wrapDislocationSegments();

	std::ofstream fout(config.outputFile);
	if(!fout){
		throw std::runtime_error("Cannot open " + config.outputFile);
	}

	searcher.writeDislocationsVTKFile(fout);

	// Calculate scalar dislocation density and density tensor
	// TODO: This may be optional, and in the future may be exported if specified.
	double dislocationDensity = 0.0;
	double dislocationDensityTensor[3][3] = { 0.0 };

	const std::vector<DislocationSegment*>& segments = searcher.getSegments();
	for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++){
		DislocationSegment* segment = segments[segmentIndex];
		const std::deque<Point3>& line = segment->line;
		// line.front() line.back() (line.back() - line.front()) (diff)
		for(std::deque<Point3>::const_iterator p1 = line.begin(), p2 = line.begin() + 1; p2 < line.end(); ++p1, ++p2){
			Vector3 delta = (*p2) - (*p1);
			dislocationDensity += Length(delta);
			for(int i = 0; i < 3; i++){
				for(int j = 0; j < 3; j++){
					dislocationDensityTensor[i][j] += delta[i] * segment->burgersVectorWorld[j];
				}
			}
		}
	}

	double volume = searcher.getSimulationCell().determinant();
	dislocationDensity /= volume;
	for(int i = 0; i < 3; i++){
		for(int j = 0; j < 3; j++){
			dislocationDensityTensor[i][j] /= volume;
		}
	}

	std::cout << "Dislocation densitity: " << dislocationDensity << std::endl;
	std::cout << "Dislocation density tensor: " << endl;
	for(int i = 0; i < 3; i++){
		std::cout << std::to_string(dislocationDensityTensor[i][0]) << " " << std::to_string(dislocationDensityTensor[i][1]) << " " << std::to_string(dislocationDensityTensor[i][2]) << " " << std::endl;
	}

	std::cerr << "Total time: " << fullTimer.elapsedTime() << " seconds." << std::endl;

	searcher.cleanup();
}

int main(int argc, char* argv[]){
	try{
		OpenDXA::Config config = parseOptions(argc, argv);
		runDislocationAnalysis(config);
	}catch(std::exception &exception){
		std::cerr << "Error: " << exception.what() << std::endl;
		return 1;
	}

	return 0;
}
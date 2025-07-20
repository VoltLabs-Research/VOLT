#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/core/property_base.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/burgers_loop_builder.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

// Set the reference crystal structure for defect identificaction.
// All atoms matching this lattice type are considered "perfect",
// and deviations (including different lattice types) will be treated as
// potential defects or dislocation cores. In the case that you use PTM, 
// you do not need to specify which type of structure should be treated as perfect.
void DislocationAnalysis::setInputCrystalStructure(LatticeStructureType structure){
    _inputCrystalStructure = structure;
}

// Define the maximum number of edges that a Burgers circuit may have.
// The tracer will not attempt to close loops longer than this size,
// preventing runaway searches in very complex meshes.
void DislocationAnalysis::setMaxTrialCircuitSize(double size){
    _maxTrialCircuitSize= size;
}

// Control how much a candidate Burgers circuit can be stretched.
// A higher stretchability allows the algorithm to consider more extreme
// extensions when refining loops, at the cost of additional computation
// and potential false positives.
void DislocationAnalysis::setCircuitStretchability(double stretch){
    _circuitStretchability = stretch;
}

// The "core atoms" are the atoms located in the region closest to the dislocation line,
// where the crystal lattice is most deformed. They do not form a line by themselves, but are
// the atoms immediately affected by the dislocation. We identify them as
// the atoms that are on or within the Burgers loop around the dislocation.
// 
// Core atoms are useful for precisely delineating which atoms form the core 
// of the dislocation. That region (composed of the atoms with "is_core = true") 
// is precisely the area where the material is most deformed at the atomic level.
// We don't rebuild the entire tessellation from scratch. We use the existing one 
// (stored in ElasticMapping), but we initialize a new spatial 
// query structure to identify the cells within the core.
void DislocationAnalysis::setMarkCoreAtoms(bool markCoreAtoms){
    _markCoreAtoms = markCoreAtoms;
}

// Enable or disable detection of only perfect dislocations.
// When true, planar faults (e.g. stacking faults whithout a full dislocation)
// are ignored. Only complete dislocation lines are reported.
void DislocationAnalysis::setOnlyPerfectDislocations(bool flag){
    _onlyPerfectDislocations = flag;
}

// Set the smoothing intensity for each dislocation line.
// Higher smoothing levels produce smoother, less jagged polylines
// at the expense of some geometric detail.
void DislocationAnalysis::setLineSmoothingLevel(double lineSmoothingLevel){
    _lineSmoothingLevel = lineSmoothingLevel;
}

// Specify the point sampling interval along each dislocation.
// Determines how many atoms (or mesh steps) to skip before adding
// the next point to the polyline. Larger intervals
// produce coarser but faster-to-compute lines.
void DislocationAnalysis::setLinePointInterval(double linePointInterval){
    _linePointInterval = linePointInterval;
}

// Set how aggressively to smooth the defect surface mesh.
// Smooths the grain-boundary mesh to reduce numerical noise.
// Larger values yield smoother interfaces but may blur sharp features.
void DislocationAnalysis::setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel){
    _defectMeshSmoothingLevel = defectMeshSmoothingLevel;
}

// Choose the per-atom classification mode: PTM or CNA.
// PTM (Polyhedral Template Matching) provides orientation and deformation 
// gradient, while CNA (Common Neighbor Analysis) is purely topological.
void DislocationAnalysis::setIdentificationMode(StructureAnalysis::Mode identificationMode){
    _identificationMode = identificationMode;
}

// Serializes a molecular dynamics frame to binary format for inter-process communication.
// This function creates a binary file containing all frame data needed for dislocation analysis,
// including atomic positions, types, IDs, simulation cell parameters, and the output filename.
void DislocationAnalysis::serializeFrame(
    const LammpsParser::Frame& frame, 
    const std::string& filename,
    const std::string& outputFile
){
    std::ofstream out(filename, std::ios::binary);
    if(!out){
        throw std::runtime_error("Cannot create frame file: " + filename);
    }

    // Write frame metadata, timestep and atom count
    out.write(reinterpret_cast<const char*>(&frame.timestep), sizeof(frame.timestep));
    out.write(reinterpret_cast<const char*>(&frame.natoms), sizeof(frame.natoms));
    
    // Extract and serialize simulation cell parameters
    auto matrix = frame.simulationCell.matrix();
    auto pbcFlags = frame.simulationCell.pbcFlags();
    bool is2D = frame.simulationCell.is2D();
    
    out.write(reinterpret_cast<const char*>(&matrix), sizeof(matrix));
    out.write(reinterpret_cast<const char*>(&pbcFlags), sizeof(pbcFlags));
    out.write(reinterpret_cast<const char*>(&is2D), sizeof(is2D));
    
    // Serialize atomic positions array with size prefix for safe deserialization
    size_t posSize = frame.positions.size();
    out.write(reinterpret_cast<const char*>(&posSize), sizeof(posSize));
    out.write(reinterpret_cast<const char*>(frame.positions.data()), posSize * sizeof(Point3));
    
    // Serialize atom types array with size prefix
    size_t typesSize = frame.types.size();
    out.write(reinterpret_cast<const char*>(&typesSize), sizeof(typesSize));
    out.write(reinterpret_cast<const char*>(frame.types.data()), typesSize * sizeof(int));
    
    // Serialiez atom IDs array with size prefix
    size_t idsSize = frame.ids.size();
    out.write(reinterpret_cast<const char*>(&idsSize), sizeof(idsSize));
    out.write(reinterpret_cast<const char*>(frame.ids.data()), idsSize * sizeof(int));
    
    // Serialize output filename as length-prefixed string
    size_t outputLen = outputFile.length();
    out.write(reinterpret_cast<const char*>(&outputLen), sizeof(outputLen));
    out.write(outputFile.c_str(), outputLen);
    
    out.close();
}

// Deserializes a molecular dynamics frame from binary format.
// This function reads back all frame data that was previously serialized,
// reconstructing the complete Frame object and associated output filename.
std::pair<LammpsParser::Frame, std::string> DislocationAnalysis::deserializeFrame(const std::string& filename){
    std::ifstream in(filename, std::ios::binary);
    if(!in){
        throw std::runtime_error("Cannot open frame file: " + filename);
    }
    
    LammpsParser::Frame frame;

    // Read frame data, timestep and atom count
    in.read(reinterpret_cast<char*>(&frame.timestep), sizeof(frame.timestep));
    in.read(reinterpret_cast<char*>(&frame.natoms), sizeof(frame.natoms));
    
    // Read simulation cell parameters into temporary variables
    AffineTransformation matrix;
    std::array<bool, 3> pbcFlags;
    bool is2D;
    
    in.read(reinterpret_cast<char*>(&matrix), sizeof(matrix));
    in.read(reinterpret_cast<char*>(&pbcFlags), sizeof(pbcFlags));
    in.read(reinterpret_cast<char*>(&is2D), sizeof(is2D));
    
    // Reconstruct simulation cell from deserialized parameters
    frame.simulationCell.setMatrix(matrix);
    frame.simulationCell.setPbcFlags(pbcFlags);
    frame.simulationCell.set2D(is2D);
    
    // Get size first, then allocate and read data
    size_t posSize;
    in.read(reinterpret_cast<char*>(&posSize), sizeof(posSize));
    frame.positions.resize(posSize);
    in.read(reinterpret_cast<char*>(frame.positions.data()), posSize * sizeof(Point3));

    size_t typesSize;
    in.read(reinterpret_cast<char*>(&typesSize), sizeof(typesSize));
    frame.types.resize(typesSize);
    in.read(reinterpret_cast<char*>(frame.types.data()), typesSize * sizeof(int));
    
    size_t idsSize;
    in.read(reinterpret_cast<char*>(&idsSize), sizeof(idsSize));
    frame.ids.resize(idsSize);
    in.read(reinterpret_cast<char*>(frame.ids.data()), idsSize * sizeof(int));
    
    size_t outputLen;
    in.read(reinterpret_cast<char*>(&outputLen), sizeof(outputLen));

    // Pre-allocate string with null chars
    std::string outputFile(outputLen, '\0');
    // Read directly into string buffer
    in.read(&outputFile[0], outputLen);
    
    in.close();
    
    return {frame, outputFile};
}

// Multi-process parallel analysis of multiple frames.
// This function implements a fork-based parallel processing system to 
// analyze multiple frames simultaneously. Each frame is processed in a 
// separate child process to maximize CPU utilization and isolate potential crashes.
// 
// TODO: Performance is good. However, I personally think this isn't the best solution. 
// TODO: Perhaps I could parallelize by using the CPU directly and not creating processes.
// TODO: Because it introduces overhead. So why do I do it this way? Not all code is thread-safe.
json DislocationAnalysis::compute(
    const std::vector<LammpsParser::Frame>& frames,
    const std::string& outputFileTemplate,
    const ProgressCallback& progressCallback
){
    const auto startTime = std::chrono::high_resolution_clock::now();
    const size_t numFrames = frames.size();
    const size_t threads = std::thread::hardware_concurrency();
    const size_t maxProcesses = std::min(threads > 0 ? threads : 1, numFrames);

    json report;
    report["is_failed"] = false;
    report["frames"] = json::array();
    report["total_time"] = 0;

    if(frames.empty()) return report;

    spdlog::info("Processing {} frames using {} processes", numFrames, maxProcesses);

    // Create unique temporary directory for this analysis
    // Using PID and timestamp ensures uniqueness across concurrent runs
    std::string tempDir = "/tmp/dislocation_analysis_" + std::to_string(getpid()) + "_" + std::to_string(time(nullptr));
    if(mkdir(tempDir.c_str(), 0755) != 0){
        spdlog::error("Failed to create temp directory: {}", tempDir);
        throw std::runtime_error("Failed to create temporary directory");
    }

    // Pre-allocate filename vectors for all frames
    // Serialized frame data files
    std::vector<std::string> frameFiles(numFrames);
    // JSON result files from child processes
    std::vector<std::string> resultFiles(numFrames);
    // Final output filenames
    std::vector<std::string> outputFiles(numFrames);

    // Generate all filenames and serialize frame to temporary files
    for(size_t i = 0; i < numFrames; ++i){
        frameFiles[i] = tempDir + "/frame_" + std::to_string(i);
        resultFiles[i] = tempDir + "/result_" + std::to_string(i) + ".json";

        // Generate output filename using template and frame timestep
        outputFiles[i] = std::vformat(outputFileTemplate, std::make_format_args(frames[i].timestep));
        // Serialize frame data for child process consumption
        serializeFrame(frames[i], frameFiles[i], outputFiles[i]);
    }

    // Initialize process management data structures
    // Results from each frame
    std::vector<json> frameResults(numFrames);
    // Max process IDs to frame indices
    std::map<pid_t, size_t> pidToIndex;
    // Next frame to process
    size_t currentFrame = 0;
    // Number of completed frames
    size_t completedFrames = 0;

    // Lambda function to launch a child process for frame analysis.
    // The child process creates its own DislocationAnalysis instances with copied parameters,
    // then deserializes the frame data from the binary file for runs the single frame
    // compute() analysis. Then serializes results to JSON file and exists with appropiate status code.
    auto launchProcess = [&](size_t frameIndex) -> pid_t {
        pid_t pid = fork();
        if(pid == 0){
            try{
                DislocationAnalysis childAnalysis;
                childAnalysis._inputCrystalStructure = this->_inputCrystalStructure;
                childAnalysis._maxTrialCircuitSize = this->_maxTrialCircuitSize;
                childAnalysis._circuitStretchability = this->_circuitStretchability;
                childAnalysis._lineSmoothingLevel = this->_lineSmoothingLevel;
                childAnalysis._linePointInterval = this->_linePointInterval;
                childAnalysis._defectMeshSmoothingLevel = this->_defectMeshSmoothingLevel;
                childAnalysis._identificationMode = this->_identificationMode;
                childAnalysis._markCoreAtoms = this->_markCoreAtoms;
                childAnalysis._onlyPerfectDislocations = this->_onlyPerfectDislocations;

                // Load and process frame from file
                auto [frame, outputFile] = deserializeFrame(frameFiles[frameIndex]);
                auto result = childAnalysis.compute(frame, outputFile);
                result["output_file"] = outputFile;

                // Save analysis result to JSON file to parent process retrieval
                std::ofstream resultOutput(resultFiles[frameIndex]);
                resultOutput << result.dump(2);
                resultOutput.close();
                exit(0);
            }catch(const std::exception &e){
                // Handle known exceptions by writing error JSON
                std::ofstream errorOutput(resultFiles[frameIndex]);
                json errorResult;
                errorResult["is_failed"] = true;
                errorResult["error"] = std::string("Child process exception: ") + e.what();
                errorOutput << errorResult.dump(2);
                errorOutput.close();
                exit(1);
            }catch(...){
                // Handle unkown exceptions
                std::ofstream errorOutput(resultFiles[frameIndex]);
                json errorResult;
                errorResult["is_failed"] = true;
                errorResult["error"] = "Unknown exception in child process";
                errorOutput << errorResult.dump(2);
                errorOutput.close();
                exit(2);
            }
        }
        
        // Child PID to parent process
        return pid;
    };

    // Main process management loop.
    // This implements a dynamic fork queue where processes are launched
    // as needed and completed processes are immediately replaced with new ones
    // until all frames are processed.
    while(completedFrames < numFrames){
        // Launch new processes up to the concurrency limit
        while(pidToIndex.size() < maxProcesses && currentFrame < numFrames){
            pid_t pid = launchProcess(currentFrame);
            if(pid > 0){
                // Successfully forked - track the process
                pidToIndex[pid] = currentFrame;
                spdlog::debug("Launched process {} for frame {}", pid, currentFrame);
                currentFrame++;
            }else{
                // Fork failed - record error and continue
                spdlog::error("Failed to fork process for frame {}", currentFrame);
                frameResults[currentFrame] = json{
                    {"is_failed", true},
                    {"error", "Failed to fork process"}
                };
                completedFrames++;
                currentFrame++;
            }
        }

        // Wait for any child process to completed
        if(!pidToIndex.empty()){
            int status;
            // Block until any child exists
            pid_t finishedPid = waitpid(-1, &status, 0);
            if(finishedPid > 0){
                // Find and remove the completed process from tracking
                auto it = pidToIndex.find(finishedPid);
                if(it != pidToIndex.end()){
                    size_t frameIndex = it->second;
                    pidToIndex.erase(it);
                    spdlog::debug("Process {} finished for frame {}", finishedPid, frameIndex);
                    // Load the analysis result from the child process output file
                    try{
                        std::ifstream resultIn(resultFiles[frameIndex]);
                        if(resultIn.good()){
                            std::string resultStr((std::istreambuf_iterator<char>(resultIn)), std::istreambuf_iterator<char>());
                            frameResults[frameIndex] = json::parse(resultStr);
                        }else{
                            frameResults[frameIndex] = json{
                                {"is_failed", true},
                                {"error", "Could not read result file"}
                            };
                        }
                    }catch(const std::exception &e){
                        // JSON parsing or file I/O error
                        frameResults[frameIndex] = json{
                            {"is_failed", true},
                            {"error", std::string("Error parsing result: ") + e.what()}
                        };
                    }
    
                    completedFrames++;
                    spdlog::info("Completed frame {}/{}", completedFrames, numFrames);

                    if(progressCallback){
                        ProgressInfo info{
                            .completedFrames = completedFrames,
                            .totalFrames = numFrames,
                            .frameResult = &frameResults[frameIndex]
                        };
                        progressCallback(info);
                    }
                }
            }else if(finishedPid == -1 && errno == ECHILD){
                // No more child processes exit, break out of wait loop
                break;
            }
        }
    }

    // Clean up any remaining zombie processes
    // This prevents zombie processes from accumulating in the system
    while(waitpid(-1, nullptr, WNOHANG) > 0);

    // Remove all temporary files and directories
    std::string command = "rm -rf " + tempDir;
    system(command.c_str());

    // Aggregate individual frame results into final report
    for(auto &result : frameResults){
        // If any frame failed, mark the entire analysis as failed
        if(result.value("is_failed", false)){
            report["is_failed"] = true;
        }
        report["frames"].push_back(std::move(result));
    }

    // Calculate and record total processing time
    auto duration = std::chrono::duration_cast<std::chrono::seconds>(
        std::chrono::high_resolution_clock::now() - startTime);
    report["total_time"] = duration.count();
    spdlog::info("Processing completed in {}s", duration.count());
    return report;
}

json DislocationAnalysis::compute(const LammpsParser::Frame &frame, const std::string& outputFile){
    auto start_time = std::chrono::high_resolution_clock::now();
    spdlog::debug("Processing frame {} with {} atoms", frame.timestep, frame.natoms);
    
    // JSON object for the output. We'll fill in errors or results as we go.
    json result;

    // If there are no atoms or no positions, we cannot proceed.
    // We short-circuit here to avoid wasting CPU.
    if(frame.natoms <= 0){
        result["is_failed"] = true;
        result["error"] = "Invalid number of atoms: " + std::to_string(frame.natoms);
        return result;
    }

    if(frame.positions.empty()){
        result["is_failed"] = true;
        result["error"] = "No position data available";
        return result;
    }

    // We transform the raw LAMMPS positions data into our ParticleProperty container.
    // If that allocation or conversion fails, we abort immediately.
    std::shared_ptr<ParticleProperty> positions;
    {
        PROFILE("Create Position Property");
        positions = createPositionProperty(frame);
        if(!positions){
            result["is_failed"] = true;
            result["error"] = "Failed to create position property";
            return result;
        }
    }

    // Validate that the simulation cell is well-formed. 
    // Later algorithms assume a proper periodic box.
    if(!validateSimulationCell(frame.simulationCell)){
        result["is_failed"] = true;
        result["error"] = "Invalid simulation cell";
        return result;
    }

    // We want to allow PTM to align clusters to certain reference orientations.
    // Here we give it the identity orientation by default.
    std::vector<Matrix3> preferredOrientations;
    preferredOrientations.push_back(Matrix3::Identity());

    // Construct the StructureAnalysis object to perform PTM/CNA, clustering,
    // and super-cluster formation. It will fill our structureTypes buffer
    // with a type code per atom.
    std::unique_ptr<ParticleProperty> structureTypes;
    std::unique_ptr<StructureAnalysis> structureAnalysis;
    
    {
        PROFILE("Structure Analysis Setup");
        structureTypes = std::make_unique<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);

        structureAnalysis = std::make_unique<StructureAnalysis>(
            positions.get(),
            frame.simulationCell,
            _inputCrystalStructure,
            // TODO:
            nullptr,
            structureTypes.get(),
            std::move(preferredOrientations),
            !_onlyPerfectDislocations,
            _identificationMode
        );
    }
    
    // Using the newly created analyzer, we detect each atom's local structure
    // (e.g. FCC vs HCP). Any failure here means we cannot continue.
    {
        PROFILE("Identify Structures");
        structureAnalysis->identifyStructures();
    }

    // Once every atom has a type, we group them into clusters that represent grains or regions of the same lattice.
    // Dislocations do NOT appear everywhere. They appear specifically at grain boundaries.
    // Without clusters, we would have to search for dislocations in every atom, which is inefficient; 
    // with clusters, we only search at boundaries. And boundaries are found when 
    // "an atom in cluster A has a neighbor in cluster B," that is, those two atoms are on the boundary.
    {
        PROFILE("Build Clusters");
        structureAnalysis->buildClusters();
    }

    // After clustering, we connect neighboring clusters to map out the boundaries.
    // This connectivity informs how we will mesh the interface between grains.
    {
        PROFILE("Connect Clusters");
        structureAnalysis->connectClusters();
    }

    // We then detect and merge any defect clusters into superclusters, ensuring that
    // planar defects are treated properly rather tan as random noise.
    {
        PROFILE("Form Super Clusters");
        structureAnalysis->formSuperClusters();
    }

    std::vector<int> extractedStructureTypes;
    extractedStructureTypes.reserve(frame.natoms);
    
    for(int i = 0; i < frame.natoms; ++i){
        int structureType = structureAnalysis->structureTypes()->getInt(i);
        extractedStructureTypes.push_back(structureType);
    }

    // Next, we perform a periodic Delaunay Tessellation of all atomic positions.
    // The ghostLayerSize is chosen based on the maximum neighbor distance so that
    // our mesh seamlessly wraps across periodic boundaries.
    DelaunayTessellation tessellation;
    double ghostLayerSize;
    {
        PROFILE("Delaunay Tessellation");
        ghostLayerSize = 3.5f * structureAnalysis->maximumNeighborDistance();
        tessellation.generateTessellation(
            structureAnalysis->cell(),
            structureAnalysis->positions()->constDataPoint3(),
            structureAnalysis->atomCount(),
            ghostLayerSize,
            false,
            nullptr
        );
    }

    // With the tessellation in hand, we map elastic properties onto it:
    // creating mesh edges, assigning each vertex to the correct cluster,
    // and tagging each edge with its ideal Burgers vector.
    ElasticMapping elasticMap(*structureAnalysis, tessellation);
    {
        PROFILE("Elastic Mapping - Generate Edges");
        elasticMap.generateTessellationEdges();
    }

    {
        PROFILE("Elastic Mapping - Assign Vertices");
        elasticMap.assignVerticesToClusters();
    }

    {
        PROFILE("Elastic Mapping - Assign Ideal Vectors");
        elasticMap.assignIdealVectorsToEdges(false, 4);
    }
    
    // We no longer need the detailed neighbor lists, so we free them now to
    // keep memory usage in check before building the interface mesh.
    structureAnalysis->freeNeighborLists();

    // The InterfaceMesh is built on top of the elastic mapping, using the
    // maximum neighbor distance again to define connectivity. It extracts
    // a surface mesh along cluster boundaries, which is the playground for
    // tracing dislocation loops.
    InterfaceMesh interfaceMesh(elasticMap);
    {
        PROFILE("Interface Mesh - Create Mesh");
        interfaceMesh.createMesh(structureAnalysis->maximumNeighborDistance());
    }

    // Now we hand the interface mesh to the BurgersLoopBuilder. This component
    // finds Burgers circuits on that surface, refines them, join fragments,
    // and identifies junctions. If it fails, the analysis cannot continue.
    BurgersLoopBuilder tracer(
        interfaceMesh, 
        &structureAnalysis->clusterGraph(),
        _maxTrialCircuitSize, 
        _circuitStretchability,
        _markCoreAtoms
    );
    {
        PROFILE("Burgers Loop Builder - Trace Dislocation Segments");
        tracer.traceDislocationSegments();
    }

    {
        PROFILE("Burgers Loop Builder - Finish Dislocation Segments");
        tracer.finishDislocationSegments(_inputCrystalStructure);
    }

    // Wrap the result in a DislocationNetwork for easier post-processing.
    auto networkUptr = std::make_unique<DislocationNetwork>(tracer.network());
    spdlog::debug("Found {} dislocation segments", networkUptr->segments().size());

    // Generate defect mesh
    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex> defectMesh;
    interfaceMesh.generateDefectMesh(tracer, defectMesh);

    // To produce clean output, we smooth both the defect surface mesh and
    // each dislocation line. Without smoothing, visualizations can look jagged.
    {
        PROFILE("Post Processing - Smooth Vertices & Smooth Dislocation Lines");
        // TODO: I probably implemented this method wrong, it distorts everything
        // defectMesh.smoothVertices(_defectMeshSmoothingLevel);
        networkUptr->smoothDislocationLines(_lineSmoothingLevel, _linePointInterval);
        spdlog::debug("Defect mesh facets: {} ", defectMesh.faces().size());
    }

    double totalLineLength = 0.0;
    const auto& segments = networkUptr->segments();
    
    // Summing the total length of every dislocation segment provides a
    // quantitative metric of defect content.
    #pragma omp parallel for reduction(+:totalLineLength) schedule(dynamic)
    for(size_t i = 0; i < segments.size(); ++i){
        DislocationSegment* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            double len = segment->calculateLength();
            totalLineLength += len;
        }
    }

    spdlog::debug("Total line length: {} ", totalLineLength);

    // Finally, we serialize all results-mesh, network data, metrics-into JSON. 
    // Any exception here is considered a fatal error in the exporter.
    {
        try{
            PROFILE("JSON Exporter - Export Analysis Data");
            result = _jsonExporter.exportAnalysisData(
                networkUptr.get(), 
                defectMesh,
                &interfaceMesh, 
                frame, 
                &tracer, 
                &extractedStructureTypes
            );
            // _jsonExporter.exportInterfaceMeshToVTK(interfaceMesh, *structureAnalysis, "interface_mesh.vtk");
            /*const int* intData = structureTypes->constDataInt();
            size_t dataSize = structureTypes->size();
            std::vector<int> tempVector(intData, intData + dataSize);
            _jsonExporter.exportAtomsToVTK(frame, &tracer, &tempVector, "atoms.vtk");*/
        }catch(const std::exception& e){
            result["is_failed"] = true;
            result["error"] = e.what();
            return result;
        }
    }

    if(!result.contains("is_failed")){
        result["is_failed"] = false;
    }

    spdlog::debug("Json output file: {}", outputFile);

    // Clean up all intermediate data to free memory before returning.
    networkUptr.reset();
    structureAnalysis.reset();
    structureTypes.reset();
    positions.reset();

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    result["total_time"] = duration;

    spdlog::debug("Total time {} ms ", duration);

    return result;
}

// Allocates a PositionProperty of size frame.natoms, verifies correct allocation,
// retrieves its uderlying Point3 buffer, and copies in the LAMMPS positions.
std::shared_ptr<ParticleProperty> DislocationAnalysis::createPositionProperty(const LammpsParser::Frame &frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(
        frame.natoms, ParticleProperty::PositionProperty, 0, true));

    if(!property || property->size() != frame.natoms){
        std::cerr << "Failed to allocate ParticleProperty for positions with correct size" << std::endl;
        return nullptr;
    }

    Point3 *data = property->dataPoint3();
    if(!data){
        std::cerr << "Failed to get position data pointer from ParticleProperty" << std::endl;
        return nullptr;
    }

    for(size_t i = 0; i < frame.positions.size() && i < static_cast<size_t>(frame.natoms); i++){
        data[i] = frame.positions[i];
    }

    spdlog::debug("Position property created successfully with {} particles ", property->size());

    return property;
}

// Checks each entry of the cell's affine transformation matrix for NaN or Inf,
// then computes the 3D volume and ensures it is positive and finite.
bool DislocationAnalysis::validateSimulationCell(const SimulationCell &cell){
    const AffineTransformation &matrix = cell.matrix();
    // Verify no matrix components are NaN or infinite
    for(int i = 0; i < 3; i++){
        for(int j = 0; j < 3; j++){
            double val = matrix(i, j);
            if(std::isnan(val) || std::isinf(val)){
                std::cerr << "Invalid cell matrix component at (" << i << "," << j << "): " << val << std::endl;
                return false;
            }
        }
    }

    // Check that the volume is positive and finite
    double volume = cell.volume3D();
    if(volume <= 0 || std::isnan(volume) || std::isinf(volume)){
        std::cerr << "Invalid cell volume: " << volume << std::endl;
        return false;
    }

    spdlog::debug("Cell volume: {} ", volume);
    return true;
}

// TODO:
// If no compute() call has been made, or if it produced no JSON data,
// emis an error to stderr and returns an empty JSON object.
json DislocationAnalysis::exportResultsToJson(const std::string& filename) const {
    if (_lastJsonData.empty()) {
        std::cerr << "No analysis results available for export. Run compute() first." << std::endl;
        return json();
    }
    
    return _lastJsonData;
}

}
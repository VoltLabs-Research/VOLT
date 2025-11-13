#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/core/property_base.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/cluster_connector.h>

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

// Output structure identification only
void DislocationAnalysis::setStructureIdentificationOnly(bool structureIdentificationOnly){
    _structureIdentificationOnly = structureIdentificationOnly;
}

// Output grain segmentation only
void DislocationAnalysis::setGrainSegmentationOnly(bool grainSegmentationOnly){
    _grainSegmentationOnly = grainSegmentationOnly;
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

void DislocationAnalysis::setRmsd(float rmsd){
    _rmsd = rmsd;
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
    std::unique_ptr<StructureAnalysis> structureAnalysis;
    
    auto structureTypes = std::make_unique<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);
    AnalysisContext context(
        positions.get(),
        frame.simulationCell,
        _inputCrystalStructure,
        nullptr,
        structureTypes.get(),
        std::move(preferredOrientations)
    );

    {
        PROFILE("Structure Analysis Setup");

        structureAnalysis = std::make_unique<StructureAnalysis>(
            context,
            !_onlyPerfectDislocations,
            _identificationMode,
            _rmsd
        );
    }
    
    // Using the newly created analyzer, we detect each atom's local structure
    // (e.g. FCC vs HCP). Any failure here means we cannot continue.
    {
        PROFILE("Identify Structures");
        structureAnalysis->identifyStructures();
    }

    std::vector<int> extractedStructureTypes;
    extractedStructureTypes.reserve(frame.natoms);
    
    for(int i = 0; i < frame.natoms; ++i){
        int structureType = structureAnalysis->context().structureTypes->getInt(i);
        extractedStructureTypes.push_back(structureType);
    }

    if(_structureIdentificationOnly && !outputFile.empty()){
        json atomsData = structureAnalysis->getStructureStatisticsJson();

        std::ofstream atomsOf(outputFile + "_atoms.msgpack");
        std::vector<std::uint8_t> atomsMsgPack = nlohmann::json::to_msgpack(atomsData);
        // atomsOf.write(reinterpret_cast<const char*>(atomsMsgPack.data()), atomsMsgPack.size());
        atomsOf << atomsData.dump().c_str();

        atomsOf.close();

        return atomsData;
    }

    // If grain segmentation only is requested, perform grain segmentation and export GLB
    if(_grainSegmentationOnly && !outputFile.empty()){
        json grainData = performGrainSegmentation(frame, *structureAnalysis, extractedStructureTypes, outputFile);
        return grainData;
    }

    ClusterConnector clusterConnector(*structureAnalysis, context);

    {
        PROFILE("Build Clusters");
        clusterConnector.buildClusters();
    }

    {
        PROFILE("Connect Clusters");
        clusterConnector.connectClusters();
    }

    {
        PROFILE("Form Super Clusters");
        clusterConnector.formSuperClusters();
    }

    DelaunayTessellation tessellation;
    double ghostLayerSize;
    {
        PROFILE("Delaunay Tessellation");
        ghostLayerSize = 3.5f * structureAnalysis->maximumNeighborDistance();
        tessellation.generateTessellation(
            context.simCell,
            context.positions->constDataPoint3(),
            context.atomCount(),
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
    for(int i = 0; i < segments.size(); ++i){
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
            PROFILE("JSON Exporter - Export Analysis Data (lightweight)");
            // Build only lightweight parts in-memory to reduce peak RAM.
            result = _jsonExporter.exportAnalysisData(
                networkUptr.get(),
                defectMesh,
                &interfaceMesh,
                frame,
                &tracer,
                &extractedStructureTypes,
                /*includeDetailedNetworkInfo*/ true,
                /*includeTopologyInfo*/ true,
                /*includeDislocationsInMemory*/ false,
                /*includeAtomsInMemory*/ true
            );
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

   if(!outputFile.empty()){
        {
            PROFILE("Streaming Defect Mesh MsgPack");
            _jsonExporter.writeDefectMeshMsgpack(defectMesh, interfaceMesh.structureAnalysis(), outputFile + "_defect_mesh.msgpack");
        }

        {
            PROFILE("Streaming Atoms MsgPack");
            _jsonExporter.writeAtomsMsgpack(frame, &tracer, &extractedStructureTypes, outputFile + "_atoms.msgpack");
        }
        {
            PROFILE("Streaming Dislocations MsgPack");
            _jsonExporter.writeDislocationsMsgpack(networkUptr.get(), &frame.simulationCell, outputFile + "_dislocations.msgpack");
        }

        {
            PROFILE("Streaming Interface Mesh MsgPack");
            _jsonExporter.writeInterfaceMeshMsgpack(&interfaceMesh, outputFile + "_interface_mesh.msgpack", /*includeTopologyInfo*/ true);
        }

        {
            PROFILE("Streaming Structure Stats MsgPack");
            _jsonExporter.writeStructureStatsMsgpack(interfaceMesh.structureAnalysis(), outputFile + "_structures_stats.msgpack");
        }

        {
            PROFILE("Streaming Simulation Cell MsgPack");
            _jsonExporter.writeSimulationCellMsgpack(frame.simulationCell, outputFile + "_simulation_cell.msgpack");
        }
    }
    
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

json DislocationAnalysis::performGrainSegmentation(const LammpsParser::Frame &frame, const StructureAnalysis& structureAnalysis, 
                                                   const std::vector<int>& structureTypes, const std::string& outputFile) {
    spdlog::info("Starting grain segmentation analysis...");
    
    json result;
    
    try {
        // For now, create a simplified grain segmentation based on structure types
        // This is a placeholder implementation that groups atoms by structure type
        
        std::map<int, std::vector<size_t>> grainGroups;
        
        // Group atoms by structure type as a simple grain approximation
        for (size_t i = 0; i < structureTypes.size(); ++i) {
            int structType = structureTypes[i];
            grainGroups[structType].push_back(i);
        }

        json grainData;
        grainData["grain_count"] = grainGroups.size();
        grainData["grains"] = json::array();
        
        std::vector<int> grainIds(frame.natoms, 0);
        int grainId = 1;
        
        for (const auto& [structType, atomIndices] : grainGroups) {
            if (atomIndices.size() >= 50) { // Minimum grain size
                json grainInfo;
                grainInfo["id"] = grainId;
                grainInfo["size"] = atomIndices.size();
                grainInfo["structure_type"] = structType;
                // Default orientation (identity quaternion)
                grainInfo["orientation"] = {0.0, 0.0, 0.0, 1.0};
                grainData["grains"].push_back(grainInfo);
                
                // Assign grain IDs to atoms
                for (size_t atomIdx : atomIndices) {
                    if (atomIdx < grainIds.size()) {
                        grainIds[atomIdx] = grainId;
                    }
                }
                grainId++;
            }
        }

        // Export grain visualization as simplified JSON
        std::string jsonPath = outputFile + "_grains.glb.json";
        exportGrainModelAsGLB(frame, grainIds, jsonPath);
        grainData["glb_path"] = jsonPath;

        // Export msgpack data
        std::string msgpackPath = outputFile + "_grains.msgpack";
        std::ofstream grainFile(msgpackPath);
        grainFile << grainData.dump();
        grainFile.close();

        result = grainData;
        result["is_failed"] = false;
        
        spdlog::info("Simplified grain segmentation export completed. Found {} grains.", grainData["grain_count"]);

    } catch (const std::exception& e) {
        result["is_failed"] = true;
        result["error"] = std::string("Grain segmentation failed: ") + e.what();
        spdlog::error("Grain segmentation error: {}", e.what());
    }

    return result;
}

void DislocationAnalysis::exportGrainModelAsGLB(const LammpsParser::Frame &frame, const std::vector<int>& grainIds, 
                                                const std::string& outputPath) {
    spdlog::info("Exporting grain model as GLB to: {}", outputPath);
    
    try {
        // Create a simple point cloud with color-coded grains
        json atomsData;
        atomsData["atoms"] = json::array();
        
        // Color palette for different grains
        std::vector<std::array<float, 3>> colors = {
            {1.0f, 0.0f, 0.0f},  // Red
            {0.0f, 1.0f, 0.0f},  // Green
            {0.0f, 0.0f, 1.0f},  // Blue
            {1.0f, 1.0f, 0.0f},  // Yellow
            {1.0f, 0.0f, 1.0f},  // Magenta
            {0.0f, 1.0f, 1.0f},  // Cyan
            {1.0f, 0.5f, 0.0f},  // Orange
            {0.5f, 0.0f, 1.0f},  // Purple
            {0.0f, 0.5f, 0.0f},  // Dark Green
            {0.5f, 0.5f, 0.5f}   // Gray
        };

        for (size_t i = 0; i < frame.natoms && i < frame.positions.size(); ++i) {
            json atom;
            const auto& pos = frame.positions[i];
            
            atom["position"] = {pos.x(), pos.y(), pos.z()};
            atom["grain_id"] = grainIds[i];
            
            // Assign color based on grain ID
            int grainId = grainIds[i];
            if (grainId > 0 && grainId <= static_cast<int>(colors.size())) {
                const auto& color = colors[(grainId - 1) % colors.size()];
                atom["color"] = {color[0], color[1], color[2]};
            } else {
                // Default color for unassigned atoms
                atom["color"] = {0.8f, 0.8f, 0.8f};
            }
            
            atomsData["atoms"].push_back(atom);
        }

        atomsData["metadata"] = {
            {"generator", "OpenDXA Grain Segmentation"},
            {"timestamp", std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::system_clock::now().time_since_epoch()).count()},
            {"atom_count", frame.natoms},
            {"unique_grains", *std::max_element(grainIds.begin(), grainIds.end())}
        };

        // Export as JSON for now (GLB export would require more complex implementation)
        std::string jsonPath = outputPath + ".json";
        std::ofstream glbFile(jsonPath);
        glbFile << atomsData.dump(2);
        glbFile.close();
        
        spdlog::info("Grain model exported as JSON to: {}", jsonPath);
        
    } catch (const std::exception& e) {
        spdlog::error("Failed to export grain model as GLB: {}", e.what());
    }
}

}
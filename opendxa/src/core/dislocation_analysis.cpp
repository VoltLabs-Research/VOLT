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

// Output structure identification only
void DislocationAnalysis::setStructureIdentificationOnly(bool structureIdentificationOnly){
    _structureIdentificationOnly = structureIdentificationOnly;
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

// RMSD is adaptive from Structure Analysis. Custom RMSD
// can be provided by command line to be used by the algorithm.
void DislocationAnalysis::setCustomRmsd(float rmsd){
    _customRmsd = rmsd;
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
            _identificationMode,
            _customRmsd
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
        int structureType = structureAnalysis->structureTypes()->getInt(i);
        extractedStructureTypes.push_back(structureType);
    }

    if(_structureIdentificationOnly){
        json atomsData = structureAnalysis->getAtomsData(frame, &extractedStructureTypes);

        std::ofstream atomsOf(outputFile + "_atoms.msgpack", std::ios::binary);
        std::vector<std::uint8_t> atomsMsgPack = nlohmann::json::to_msgpack(result["atoms"]);
        atomsOf.write(reinterpret_cast<const char*>(atomsMsgPack.data()), atomsMsgPack.size());
        atomsOf.close();
        
        return atomsData;
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

    std::cout << defectMesh.faces().size() << std::endl;

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
            PROFILE("JSON Exporter - Export Analysis Data");
            result = _jsonExporter.exportAnalysisData(
                networkUptr.get(), 
                defectMesh,
                &interfaceMesh, 
                frame, 
                &tracer, 
                &extractedStructureTypes
            );
            /*const int* intData = structureTypes->constDataInt();
            size_t dataSize = structureTypes->size();
            std::vector<int> tempVector(intData, intData + dataSize);*/
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
        std::ofstream defectMeshOf(outputFile + "_defect_mesh.msgpack", std::ios::binary);
        std::vector<std::uint8_t> defectMeshMsgPack = nlohmann::json::to_msgpack(result["defect_mesh"]);
        defectMeshOf.write(reinterpret_cast<const char*>(defectMeshMsgPack.data()), defectMeshMsgPack.size());
        defectMeshOf.close();

        std::ofstream atomsOf(outputFile + "_atoms.msgpack", std::ios::binary);
        std::vector<std::uint8_t> atomsMsgPack = nlohmann::json::to_msgpack(result["atoms"]);
        atomsOf.write(reinterpret_cast<const char*>(atomsMsgPack.data()), atomsMsgPack.size());
        atomsOf.close();

        std::ofstream dislocationsOf(outputFile + "_dislocations.msgpack", std::ios::binary);
        std::vector<std::uint8_t> dislocationsMsgPack = nlohmann::json::to_msgpack(result["dislocations"]);
        dislocationsOf.write(reinterpret_cast<const char*>(dislocationsMsgPack.data()), dislocationsMsgPack.size());
        dislocationsOf.close();

        std::ofstream interfaceMeshOf(outputFile + "_interface_mesh.msgpack", std::ios::binary);
        std::vector<std::uint8_t> interfaceMeshMsgPack = nlohmann::json::to_msgpack(result["interface_mesh"]);
        interfaceMeshOf.write(reinterpret_cast<const char*>(interfaceMeshMsgPack.data()), interfaceMeshMsgPack.size());
        interfaceMeshOf.close();

        std::ofstream structuresOf(outputFile + "_structures_stats.msgpack", std::ios::binary);
        std::vector<std::uint8_t> structuresMsgPack = nlohmann::json::to_msgpack(result["structures"]);
        structuresOf.write(reinterpret_cast<const char*>(structuresMsgPack.data()), structuresMsgPack.size());
        structuresOf.close();

        std::ofstream simulationCellOf(outputFile + "_simulation_cell.msgpack", std::ios::binary);
        std::vector<std::uint8_t> simulationCellMsgPack = nlohmann::json::to_msgpack(result["simulation_cell"]);
        simulationCellOf.write(reinterpret_cast<const char*>(simulationCellMsgPack.data()), simulationCellMsgPack.size());
        simulationCellOf.close();
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

}
#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/core/property_base.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <tbb/parallel_for_each.h>
#include <vector>
#include <filesystem>
#include <string>
#include <cstdio>
#include <omp.h>
#include <cmath>
#include <iostream>

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
void DislocationAnalysis::setMaxTrialCircuitSize(int size){
    _maxTrialCircuitSize= size;
}

// Control how much a candidate Burgers circuit can be stretched.
// A higher stretchability allows the algorithm to consider more extreme
// extensions when refining loops, at the cost of additional computation
// and potential false positives.
void DislocationAnalysis::setCircuitStretchability(int stretch){
    _circuitStretchability = stretch;
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
void DislocationAnalysis::setLineSmoothingLevel(int lineSmoothingLevel){
    _lineSmoothingLevel = lineSmoothingLevel;
}

// Specify the point sampling interval along each dislocation.
// Determines how many atoms (or mesh steps) to skip before adding
// the next point to the polyline. Larger intervals
// produce coarser but faster-to-compute lines.
void DislocationAnalysis::setLinePointInterval(int linePointInterval){
    _linePointInterval = linePointInterval;
}

// Set how aggressively to smooth the defect surface mesh.
// Smooths the grain-boundary mesh to reduce numerical noise.
// Larger values yield smoother interfaces but may blur sharp features.
void DislocationAnalysis::setDefectMeshSmoothingLevel(int defectMeshSmoothingLevel){
    _defectMeshSmoothingLevel = defectMeshSmoothingLevel;
}

// Choose the per-atom classification mode: PTM or CNA.
// PTM (Polyhedral Template Matching) provides orientation and deformation 
// gradient, while CNA (Common Neighbor Analysis) is purely topological.
void DislocationAnalysis::setIdentificationMode(StructureAnalysis::Mode identificationMode){
    _identificationMode = identificationMode;
}

// This overload of compute() iterates over a list of frames, runs the per-frame
// analysis on each one, and aggregates the individual JSON results into a single
// JSON document. It also measures the total elapsed time across all frames.
json DislocationAnalysis::compute(const std::vector<LammpsParser::Frame>& frames, const std::string& output_file_template){
    auto totalStart = std::chrono::high_resolution_clock::now();
    json overall;
    overall["is_failed"] = false;
    overall["frames"] = json::array();
    for(size_t i = 0; i < frames.size(); ++i){
        char frameName[256];
        snprintf(frameName, sizeof(frameName), output_file_template.c_str(), frames[i].timestep);
        json frameJson = compute(frames[i], std::string(frameName));
        if(frameJson.value("is_failed", true)){
            overall["is_failed"] = true;
        }
        overall["frames"].push_back(std::move(frameJson));
    }
    auto totalEnd = std::chrono::high_resolution_clock::now();
    auto seconds = std::chrono::duration_cast<std::chrono::seconds>(totalEnd - totalStart).count();
    overall["total_time"] = seconds;
    return overall;
}

json DislocationAnalysis::compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile){
    auto start_time = std::chrono::high_resolution_clock::now();
    std::cout << "Setting up DXA analysis" << std::endl;

    ParallelSystem::initialize();
    std::cout << "Using " << ParallelSystem::getNumThreads() << " threads for parallel processing" << std::endl;
    
    // JSON object for the output. We'll fill in errors or results as we go.
    json result;
    result["is_failed"] = false;

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
        structureTypes = std::make_unique<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, "StructureTypes", true);

        structureAnalysis = std::make_unique<StructureAnalysis>(
            positions.get(),
            frame.simulationCell,
            _inputCrystalStructure,
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
        if(!structureAnalysis->identifyStructures()){
            result["is_failed"] = true;
            result["error"] = "identifyStructures() failed";
            return result;
        }
    }

    // Once every atom has a type, we group them into clusters that represent grains
    // or regions of the same lattice. This cluster graph underlies the 
    // later interface extraction.
    {
        PROFILE("Build Clusters");
        if(!structureAnalysis->buildClusters()){
            result["is_failed"] = true;
            result["error"] = "buildClusters() failed";
            return result;
        }
    }

    // After clustering, we connect neighboring clusters to map out the boundaries.
    // This connectivity informs how we will mesh the interface between grains.
    {
        PROFILE("Connect Clusters");
        if(!structureAnalysis->connectClusters()){
            result["is_failed"] = true;
            result["error"] = "connectClusters() failed";
            return result;
        }
    }

    // We then detect and merge any defect clusters into superclusters, ensuring that
    // planar defects are treated properly rather tan as random noise.
    {
        PROFILE("Form Super Clusters");
        if(!structureAnalysis->formSuperClusters()){
            result["is_failed"] = true;
            result["error"] = "formSuperClusters() failed";
            return result;
        }
    }

    // Next, we perform a periodic Delaunay Tessellation of all atomic positions.
    // The ghostLayerSize is chosen based on the maximum neighbor distance so that
    // our mesh seamlessly wraps across periodic boundaries.
    DelaunayTessellation tesselation;
    double ghostLayerSize;
    {
        PROFILE("Delaunay Tessellation");
        ghostLayerSize = 3.5f * structureAnalysis->maximumNeighborDistance();
        if(!tesselation.generateTessellation(structureAnalysis->cell(), structureAnalysis->positions()->constDataPoint3(), 
                structureAnalysis->atomCount(), ghostLayerSize, false, nullptr)){
            result["is_failed"] = true;
            result["error"] = "Delaunay tessellation failed";
            return result;
        }
    }

    // With the tessellation in hand, we map elastic properties onto it:
    // creating mesh edges, assigning each vertex to the correct cluster,
    // and tagging each edge with its ideal Burgers vector.
    ElasticMapping elasticMap(*structureAnalysis, tesselation);
    {
        PROFILE("Elastic Mapping - Generate Edges");
        if(!elasticMap.generateTessellationEdges()){
            result["is_failed"] = true;
            result["error"] = "generateTessellationEdges() failed";
            return result;
        }
    }

    {
        PROFILE("Elastic Mapping - Assign Vertices");
        if(!elasticMap.assignVerticesToClusters()){
            result["is_failed"] = true;
            result["error"] = "assignVerticesToClusters() failed";
            return result;
        }
    }

    {
        PROFILE("Elastic Mapping - Assign Ideal Vectors");
        if(!elasticMap.assignIdealVectorsToEdges(false, 4)){
            result["is_failed"] = true;
            result["error"] = "assignIdealVectorsToEdges() failed";
            return result;
        }
    }
    
    // We no longer need the detailed neighbor lists, so we free them now to
    // keep memory usage in check before building the interface mesh.
    structureAnalysis->freeNeighborLists();

    // The InterfaceMesh is built on top of the elastic mapping, using the
    // maximum neighbor distance again to define connectivity. It extracts
    // a surface mesh along cluster boundaries, which is the playground for
    // tracing dislocation loops.
    InterfaceMesh interfaceMesh(elasticMap);
    if(!interfaceMesh.createMesh(structureAnalysis->maximumNeighborDistance())){
        result["is_failed"] = true;
        result["error"] = "InterfaceMesh::createMesh() failed";
        return result;
    }

    // Now we hand the interface mesh to the DislocationTracer. This component
    // finds Burgers circuits on that surface, refines them, join fragments,
    // and identifies junctions. If it fails, the analysis cannot continue.
    DislocationTracer tracer(interfaceMesh, &structureAnalysis->clusterGraph(), _maxTrialCircuitSize, _circuitStretchability);
    if(!tracer.traceDislocationSegments()){
        result["is_failed"] = true;
        result["error"] = "traceDislocationSegments() failed";
        return result;
    }

    tracer.finishDislocationSegments(_inputCrystalStructure);

    // Wrap the result in a DislocationNetwork for easier post-processing.
    auto networkUptr = std::make_unique<DislocationNetwork>(tracer.network());
    std::cout << "Found " << networkUptr->segments().size() << " dislocation segments" << std::endl;

    // To produce clean output, we smooth both the defect surface mesh and
    // each dislocation line. Without smoothing, visualizations can look jagged.
    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex> defectMesh;
    defectMesh.smoothVertices(_defectMeshSmoothingLevel);
    networkUptr->smoothDislocationLines(_lineSmoothingLevel, _linePointInterval);

    std::cout << "Defect mesh facets: " << defectMesh.faces().size() << std::endl;
    std::cout << "Analysis completed successfully" << std::endl;
    
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

    std::cout << "Total line length: " << totalLineLength << std::endl;

    // Finally, we serialize all results-mesh, network data, metrics-into JSON. 
    // Any exception here is considered a fatal error in the exporter.
    try{
        result = _jsonExporter.exportAnalysisData(networkUptr.get(), &interfaceMesh, frame);
    }catch(const std::exception& e){
        result["is_failed"] = true;
        result["error"] = e.what();
        return result;
    }

    if(!jsonOutputFile.empty()){
        std::ofstream of(jsonOutputFile);
        of << result.dump(2);
    }

    // Clean up all intermediate data to free memory before returning.
    networkUptr.reset();
    structureAnalysis.reset();
    structureTypes.reset();
    positions.reset();

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    result["total_time"] = duration;

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

    std::cout << "Position property created successfully with " << property->size() << " particles" << std::endl;
    std::cout << "Property data type: " << property->type() << std::endl;
    std::cout << "Property component count: " << property->componentCount() << std::endl;

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
    std::cout << "Cell volume: " << volume << std::endl;
    return true;
}

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
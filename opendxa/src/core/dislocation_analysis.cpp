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

void DislocationAnalysis::setInputCrystalStructure(LatticeStructureType structure){
    _inputCrystalStructure = structure;
}

void DislocationAnalysis::setMaxTrialCircuitSize(int size){
    _maxTrialCircuitSize= size;
}

void DislocationAnalysis::setCircuitStretchability(int stretch){
    _circuitStretchability = stretch;
}

void DislocationAnalysis::setOnlyPerfectDislocations(bool flag){
    _onlyPerfectDislocations = flag;
}

void DislocationAnalysis::setLineSmoothingLevel(int lineSmoothingLevel){
    _lineSmoothingLevel = lineSmoothingLevel;
}

void DislocationAnalysis::setLinePointInterval(int linePointInterval){
    _linePointInterval = linePointInterval;
}

void DislocationAnalysis::setDefectMeshSmoothingLevel(int defectMeshSmoothingLevel){
    _defectMeshSmoothingLevel = defectMeshSmoothingLevel;
}

void DislocationAnalysis::setIdentificationMode(StructureAnalysis::Mode identificationMode){
    _identificationMode = identificationMode;
}

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
    
    json result;
    result["is_Failed"] = false;

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

    if(!validateSimulationCell(frame.simulationCell)){
        result["is_failed"] = true;
        result["error"] = "Invalid simulation cell";
        return result;
    }

    std::vector<Matrix3> preferredOrientations;
    preferredOrientations.push_back(Matrix3::Identity());

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
    
    {
        PROFILE("Identify Structures");
        if(!structureAnalysis->identifyStructures()){
            result["is_failed"] = true;
            result["error"] = "identifyStructures() failed";
            return result;
        }
    }

    {
        PROFILE("Build Clusters");
        if(!structureAnalysis->buildClusters()){
            result["is_failed"] = true;
            result["error"] = "buildClusters() failed";
            return result;
        }
    }

    {
        PROFILE("Connect Clusters");
        if(!structureAnalysis->connectClusters()){
            result["is_failed"] = true;
            result["error"] = "connectClusters() failed";
            return result;
        }
    }

    {
        PROFILE("Form Super Clusters");
        if(!structureAnalysis->formSuperClusters()){
            result["is_failed"] = true;
            result["error"] = "formSuperClusters() failed";
            return result;
        }
    }

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
    
    structureAnalysis->freeNeighborLists();

    InterfaceMesh interfaceMesh(elasticMap);
    if(!interfaceMesh.createMesh(structureAnalysis->maximumNeighborDistance())){
        result["is_failed"] = true;
        result["error"] = "InterfaceMesh::createMesh() failed";
        return result;
    }

    DislocationTracer tracer(interfaceMesh, &structureAnalysis->clusterGraph(), _maxTrialCircuitSize, _circuitStretchability);
    if(!tracer.traceDislocationSegments()){
        result["is_failed"] = true;
        result["error"] = "traceDislocationSegments() failed";
        return result;
    }

    tracer.finishDislocationSegments(_inputCrystalStructure);
    auto networkUptr = std::make_unique<DislocationNetwork>(tracer.network());

    std::cout << "Found " << networkUptr->segments().size() << " dislocation segments" << std::endl;

    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex> defectMesh;

    // Post-process surface mesh.
    defectMesh.smoothVertices(_defectMeshSmoothingLevel);

    // Post process dislocation lines
    networkUptr->smoothDislocationLines(_lineSmoothingLevel, _linePointInterval);

    std::cout << "Defect mesh facets: " << defectMesh.faces().size() << std::endl;
    std::cout << "Analysis completed successfully" << std::endl;
    
    ParallelSystem::initialize();
    
    double totalLineLength = 0.0;
    const auto& segments = networkUptr->segments();
    
    #pragma omp parallel for reduction(+:totalLineLength) schedule(dynamic)
    for(size_t i = 0; i < segments.size(); ++i){
        DislocationSegment* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            double len = segment->calculateLength();
            totalLineLength += len;
        }
    }

    std::cout << "Total line length: " << totalLineLength << std::endl;

    // Export analysis data to JSON
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

    networkUptr.reset();
    structureAnalysis.reset();
    structureTypes.reset();
    positions.reset();

    auto end_time = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
    result["total_time"] = duration;

    return result;
}

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

bool DislocationAnalysis::validateSimulationCell(const SimulationCell &cell){
    const AffineTransformation &matrix = cell.matrix();
    for(int i = 0; i < 3; i++){
        for(int j = 0; j < 3; j++){
            double val = matrix(i, j);
            if(std::isnan(val) || std::isinf(val)){
                std::cerr << "Invalid cell matrix component at (" << i << "," << j << "): " << val << std::endl;
                return false;
            }
        }
    }

    double volume = cell.volume3D();
    if(volume <= 0 || std::isnan(volume) || std::isinf(volume)){
        std::cerr << "Invalid cell volume: " << volume << std::endl;
        return false;
    }
    std::cout << "Cell volume: " << volume << std::endl;
    return true;
}

json DislocationAnalysis::exportResultsToJson(const std::string& filename) const {
    if (_lastJsonData.empty()) {
        std::cerr << "No analysis results available for export. Run compute() first." << std::endl;
        return json();
    }
    
    return _lastJsonData;
}

}
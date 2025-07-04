#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/core/property_base.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
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

bool DislocationAnalysis::compute(const LammpsParser::Frame &frame, const std::string& jsonOutputFile){
    std::cout << "Setting up DXA analysis..." << std::endl;
    
    // Inicializar configuración paralela al inicio
    ParallelSystem::initialize();
    std::cout << "Using " << ParallelSystem::getNumThreads() << " threads for parallel processing" << std::endl;
    
    if(frame.natoms <= 0){
        std::cerr << "Error: Invalid number of atoms: " << frame.natoms << std::endl;
        return false;
    }

    if(frame.positions.empty()){
        std::cerr << "Error: No position data available" << std::endl;
        return false;
    }

    std::shared_ptr<ParticleProperty> positions;
    {
        PROFILE("Create Position Property");
        positions = createPositionProperty(frame);
        if(!positions){
            std::cerr << "Error: Failed to create position property" << std::endl;
            return false;
        }
    }

    if(!validateSimulationCell(frame.simulationCell)){
        std::cerr << "Error: Invalid simulation cell" << std::endl;
        return false;
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
            !_onlyPerfectDislocations
        );
    }
    
    {
        PROFILE("Identify Structures");
        if(!structureAnalysis->identifyStructures()){
            return false;
        }
    }

    {
        PROFILE("Build Clusters");
        if(!structureAnalysis->buildClusters()){
            return false;
        }
    }

    {
        PROFILE("Connect Clusters");
        if(!structureAnalysis->connectClusters()){
            return false;
        }
    }

    DelaunayTessellation tesselation;
    double ghostLayerSize;
    {
        PROFILE("Delaunay Tessellation");
        ghostLayerSize = 3.5f * structureAnalysis->maximumNeighborDistance();
        if(!tesselation.generateTessellation(structureAnalysis->cell(), structureAnalysis->positions()->constDataPoint3(), 
                structureAnalysis->atomCount(), ghostLayerSize, nullptr)){
            std::cerr << "Failed Delaunay tessellation" << std::endl;
            return false;
        }
    }

    ElasticMapping elasticMap(*structureAnalysis, tesselation);
    {
        PROFILE("Elastic Mapping - Generate Edges");
        if(!elasticMap.generateTessellationEdges()){
            return false;
        }
    }

    {
        PROFILE("Elastic Mapping - Assign Vertices");
        if(!elasticMap.assignVerticesToClusters()){
            return false;
        }
    }

    {
        PROFILE("Elastic Mapping - Assign Ideal Vectors");
        if(!elasticMap.assignIdealVectorsToEdges(false, 4)){
            return false;
        }
    }
    
    structureAnalysis->freeNeighborLists();

    InterfaceMesh interfaceMesh(elasticMap);
    if(!interfaceMesh.createMesh(structureAnalysis->maximumNeighborDistance(), nullptr)){
        std::cerr << "Failed InterfaceMesh::createMesh()" << std::endl;
        return false;
    }

    DislocationTracer tracer(interfaceMesh, &structureAnalysis->clusterGraph(), _maxTrialCircuitSize, _circuitStretchability);
    if(!tracer.traceDislocationSegments()){
        std::cerr << "Failed traceDislocationSegments()" << std::endl;
        return false;
    }

    tracer.finishDislocationSegments(_inputCrystalStructure);
    auto networkUptr = std::make_unique<DislocationNetwork>(tracer.network());

    std::cout << "Found " << networkUptr->segments().size() << " dislocation segments" << std::endl;

    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex> defectMesh;

    SmoothDislocationsModifier smoother;
    smoother.setSmoothingEnabled(true);
    smoother.setSmoothingLevel(2);
    smoother.setCoarseningEnabled(true);
    smoother.setLinePointInterval(2.5);
    smoother.smoothDislocationLines(networkUptr.get());

    std::cout << "Defect mesh facets: " << defectMesh.faces().size() << std::endl;
    std::cout << "Analysis completed successfully" << std::endl;
    
    ParallelSystem::initialize();
    
    double totalLineLength = 0.0;
    const auto& segments = networkUptr->segments();
    
    // Paralelizar el cálculo de longitud total
    #pragma omp parallel for reduction(+:totalLineLength) schedule(dynamic)
    for(size_t i = 0; i < segments.size(); ++i){
        DislocationSegment* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            double len = segment->calculateLength();
            totalLineLength += len;
        }
    }

    std::cout << "Total line length: " << totalLineLength << std::endl;

    if(!jsonOutputFile.empty()){
        try{
            _lastFrame = frame;
            _lastJsonData = _jsonExporter.exportAnalysisData(networkUptr.get(), &interfaceMesh, frame);
            
            std::ofstream outputFile(jsonOutputFile);
            if(outputFile.is_open()){
                outputFile << _lastJsonData.dump(2);
                outputFile.close();
                std::cout << "JSON export saved to: " << jsonOutputFile << std::endl;
            }else{
                std::cerr << "Warning: Could not open output file: " << jsonOutputFile << std::endl;
            }
        }catch(const std::exception& e){
            std::cerr << "Error during JSON export: " << e.what() << std::endl;
        }
    }

    networkUptr.reset();
    structureAnalysis.reset();
    structureTypes.reset();
    positions.reset();

    return true;
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
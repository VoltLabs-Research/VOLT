#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/cluster_connector.h>
#include <opendxa/utilities/msgpack_writer.h>
#include <spdlog/spdlog.h>

namespace OpenDXA{

using namespace OpenDXA::Particles;

DislocationAnalysis::DislocationAnalysis()
    : _inputCrystalStructure(LATTICE_FCC),
      _maxTrialCircuitSize(14),
      _circuitStretchability(9),
      _lineSmoothingLevel(10),
      _linePointInterval(2.5),
      _defectMeshSmoothingLevel(8),
      _rmsd(0.12f),
      _identificationMode(StructureAnalysis::Mode::CNA),
      _markCoreAtoms(false),
      _structureIdentificationOnly(false),
      _onlyPerfectDislocations(false) {}

void DislocationAnalysis::setInputCrystalStructure(LatticeStructureType structure){
    _inputCrystalStructure = structure;
}

void DislocationAnalysis::setStructureIdentificationOnly(bool structureIdentificationOnly){
    _structureIdentificationOnly = structureIdentificationOnly;
}

void DislocationAnalysis::setMaxTrialCircuitSize(double size){
    _maxTrialCircuitSize= size;
}

void DislocationAnalysis::setCircuitStretchability(double stretch){
    _circuitStretchability = stretch;
}

void DislocationAnalysis::setMarkCoreAtoms(bool markCoreAtoms){
    _markCoreAtoms = markCoreAtoms;
}

void DislocationAnalysis::setOnlyPerfectDislocations(bool flag){
    _onlyPerfectDislocations = flag;
}

void DislocationAnalysis::setRmsd(float rmsd){
    _rmsd = rmsd;
}

void DislocationAnalysis::setLineSmoothingLevel(double lineSmoothingLevel){
    _lineSmoothingLevel = lineSmoothingLevel;
}

void DislocationAnalysis::setLinePointInterval(double linePointInterval){
    _linePointInterval = linePointInterval;
}

void DislocationAnalysis::setDefectMeshSmoothingLevel(double defectMeshSmoothingLevel){
    _defectMeshSmoothingLevel = defectMeshSmoothingLevel;
}

void DislocationAnalysis::setIdentificationMode(StructureAnalysis::Mode identificationMode){
    _identificationMode = identificationMode;
}

json DislocationAnalysis::compute(const LammpsParser::Frame &frame, const std::string& outputFile){
    auto start_time = std::chrono::high_resolution_clock::now();
    spdlog::debug("Processing frame {} with {} atoms", frame.timestep, frame.natoms);
    
    json result;

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

    // Default orientations (Identity)
    std::vector<Matrix3> preferredOrientations;
    preferredOrientations.push_back(Matrix3::Identity());

    auto structureTypes = std::make_unique<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);
    AnalysisContext context(
        positions.get(),
        frame.simulationCell,
        _inputCrystalStructure,
        nullptr,
        structureTypes.get(),
        std::move(preferredOrientations)
    );

    std::unique_ptr<StructureAnalysis> structureAnalysis;
    {
        PROFILE("Structure Analysis Setup");
        structureAnalysis = std::make_unique<StructureAnalysis>(
            context,
            !_onlyPerfectDislocations,
            _identificationMode,
            _rmsd
        );
    }
    
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

    // If identification mode is PTM, export PTM data
    if(!outputFile.empty() && _identificationMode == StructureAnalysis::Mode::PTM){
         _jsonExporter.exportPTMData(
            structureAnalysis->context(),
            frame.ids,
            outputFile
        );
    }

    // If structure identification only is requested
    if(_structureIdentificationOnly && !outputFile.empty()){
        auto atomsData = _jsonExporter.getAtomsDataSimple(frame, *structureAnalysis, &extractedStructureTypes);
        _jsonExporter.writeJsonMsgpackToFile(atomsData, outputFile + "_atoms.msgpack");

        // TODO: DUPLICATED EXPORT
        _jsonExporter.writeJsonMsgpackToFile(atomsData, outputFile + "_structure_stats.msgpack");
        
        result = atomsData;
        result["is_failed"] = false;
        
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
        result["total_time"] = duration;
        
        return result;
    }

    // Standard Dislocation Analysis Pipeline
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
    
    structureAnalysis->freeNeighborLists();

    InterfaceMesh interfaceMesh(elasticMap);
    {
        PROFILE("InterfaceMesh - Create Mesh");
        interfaceMesh.createMesh(structureAnalysis->maximumNeighborDistance());
    }

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

    auto networkUptr = std::make_unique<DislocationNetwork>(tracer.network());
    spdlog::debug("Found {} dislocation segments", networkUptr->segments().size());

    HalfEdgeMesh<InterfaceMeshEdge, InterfaceMeshFace, InterfaceMeshVertex> defectMesh;
    interfaceMesh.generateDefectMesh(tracer, defectMesh);

    {
        PROFILE("Post Processing - Smooth Vertices & Smooth Dislocation Lines");
        networkUptr->smoothDislocationLines(_lineSmoothingLevel, _linePointInterval);
        spdlog::debug("Defect mesh facets: {} ", defectMesh.faces().size());
    }

    double totalLineLength = 0.0;
    const auto& segments = networkUptr->segments();
    
    #pragma omp parallel for reduction(+:totalLineLength) schedule(dynamic)
    for(int i = 0; i < segments.size(); ++i){
        DislocationSegment* segment = segments[i];
        if(segment && !segment->isDegenerate()){
            double len = segment->calculateLength();
            totalLineLength += len;
        }
    }

    spdlog::debug("Total line length: {} ", totalLineLength);

    {
        try{
            PROFILE("JSON Exporter - Export Analysis Data (lightweight)");
            result = _jsonExporter.exportAnalysisData(
                networkUptr.get(),
                defectMesh,
                &interfaceMesh,
                frame,
                &tracer,
                &extractedStructureTypes,
                true,
                true,
                false,
                true
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

    if(!outputFile.empty()){
        {
            PROFILE("Streaming Defect Mesh MsgPack");
            auto meshData = _jsonExporter.getMeshData(defectMesh, interfaceMesh.structureAnalysis(), true, &interfaceMesh);
            _jsonExporter.writeJsonMsgpackToFile(meshData, outputFile + "_defect_mesh.msgpack");
        }

        {
            PROFILE("Streaming Atoms MsgPack");
            auto atomsDataJson = _jsonExporter.getAtomsData(frame, &tracer, &extractedStructureTypes);
            _jsonExporter.writeJsonMsgpackToFile(atomsDataJson, outputFile + "_atoms.msgpack");
        }
        {
            PROFILE("Streaming Dislocations MsgPack");
            auto dislocationsData = _jsonExporter.exportDislocationsToJson(networkUptr.get(), true, &frame.simulationCell);
            _jsonExporter.writeJsonMsgpackToFile(dislocationsData, outputFile + "_dislocations.msgpack");
        }

        {
            PROFILE("Streaming Interface Mesh MsgPack");
            auto meshData = _jsonExporter.getMeshData(interfaceMesh, interfaceMesh.structureAnalysis(), true, &interfaceMesh);
            _jsonExporter.writeJsonMsgpackToFile(meshData, outputFile + "_interface_mesh.msgpack");
        }
        
        {
            PROFILE("Streaming Simulation Cell MsgPack");
            auto simCellInfo = _jsonExporter.getExtendedSimulationCellInfo(frame.simulationCell);
            _jsonExporter.writeJsonMsgpackToFile(simCellInfo, outputFile + "_simulation_cell.msgpack");
        }
    }
    
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

std::shared_ptr<ParticleProperty> DislocationAnalysis::createPositionProperty(const LammpsParser::Frame &frame){
    std::shared_ptr<ParticleProperty> property(new ParticleProperty(
        frame.natoms, ParticleProperty::PositionProperty, 0, true));

    if(!property || property->size() != frame.natoms){
        spdlog::error("Failed to allocate ParticleProperty for positions");
        return nullptr;
    }

    Point3 *data = property->dataPoint3();
    if(!data){
        spdlog::error("Failed to get position data pointer");
        return nullptr;
    }

    for(size_t i = 0; i < frame.positions.size() && i < static_cast<size_t>(frame.natoms); i++){
        data[i] = frame.positions[i];
    }

    return property;
}

bool DislocationAnalysis::validateSimulationCell(const SimulationCell &cell){
    const AffineTransformation &matrix = cell.matrix();
    for(int i = 0; i < 3; i++){
        for(int j = 0; j < 3; j++){
            double val = matrix(i, j);
            if(std::isnan(val) || std::isinf(val)){
                spdlog::error("Invalid cell matrix component at ({},{}): {}", i, j, val);
                return false;
            }
        }
    }

    double volume = cell.volume3D();
    if(volume <= 0 || std::isnan(volume) || std::isinf(volume)){
        spdlog::error("Invalid cell volume: {}", volume);
        return false;
    }
    return true;
}

}
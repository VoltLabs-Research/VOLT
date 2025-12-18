#include <opendxa/core/dislocation_analysis.h>
#include <opendxa/analysis/structure_analysis.h>
#include <opendxa/analysis/coordination_analysis.h>
#include <opendxa/analysis/atomic_strain.h>
#include <opendxa/analysis/elastic_strain.h>
#include <opendxa/core/property_base.h>
#include <opendxa/utilities/concurrence/parallel_system.h>
#include <opendxa/analysis/analysis_context.h>
#include <opendxa/analysis/cluster_connector.h>
#include <opendxa/analysis/grain_segmentation.h>
#include <opendxa/utilities/msgpack_writer.h>

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

void DislocationAnalysis::setGrainSegmentationParameters(
    bool adoptOrphanAtoms,
    int minGrainAtomCount,
    bool handleCoherentInterfaces,
    bool outputBonds
){
    _grainAdoptOrphanAtoms = adoptOrphanAtoms;
    _grainMinAtomCount = minGrainAtomCount;
    _grainHandleCoherentInterfaces = handleCoherentInterfaces;
    _grainOutputBonds = outputBonds;
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

void DislocationAnalysis::setCoordinationAnalysisOnly(bool flag){
    _coordinationAnalysisOnly = flag;
}

void DislocationAnalysis::setCoordinationCutoff(double cutoff){
    _coordinationCutoff = cutoff;
}

void DislocationAnalysis::setCoordinationRdfBins(int bins){
    _coordinationRdfBins = bins;
}

void DislocationAnalysis::enableAtomicStrain(bool flag){
    _atomicStrainEnabled = flag;
}

void DislocationAnalysis::setAtomicStrainCutoff(double cutoff){
    _atomicStrainCutoff = cutoff;
}

void DislocationAnalysis::enableElasticStrain(bool flag){
    _elasticStrainEnabled = flag;
}

void DislocationAnalysis::setElasticStrainParameters(
    double latticeConstant,
    double caRatio,
    bool pushForward,
    bool calculateDeformationGradient,
    bool calculateStrainTensors
){
    _elasticLatticeConstant = latticeConstant;
    _elasticCaRatio = caRatio;
    _elasticPushForward = pushForward;
    _elasticCalcDefGrad = calculateDeformationGradient;
    _elasticCalcStrainTensors = calculateStrainTensors;
}

void DislocationAnalysis::setAtomicStrainOptions(
    bool eliminateCellDeformation,
    bool assumeUnwrappedCoordinates,
    bool calculateDeformationGradient,
    bool calculateStrainTensors,
    bool calcD2min
){
    _atomicStrainEliminateCellDeformation = eliminateCellDeformation;
    _atomicStrainAssumeUnwrappedCoordinates = assumeUnwrappedCoordinates;
    _atomicStrainCalcDeformationGradients = calculateDeformationGradient;
    _atomicStrainCalcStrainTensors = calculateStrainTensors;
    _atomicStrainCalcNonaffineSquaredDisplacements = calcD2min;
}

void DislocationAnalysis::setAtomicStrainReferenceFrame(const LammpsParser::Frame &ref){
    _atomicStrainReferenceFrame = ref;
    _hasAtomicStrainReference = true;
}

json DislocationAnalysis::computeAtomicStrain(
    const LammpsParser::Frame& currentFrame,
    const LammpsParser::Frame& refFrame,
    ParticleProperty* positions,
    const std::string& outputFilename
){
    if(currentFrame.natoms != refFrame.natoms){
        throw std::runtime_error("Cannot calculate atomic strain. Number of atoms in current and reference frames does not match.");
    }

    auto refPositions = std::make_shared<ParticleProperty>(
        refFrame.positions.size(),
        ParticleProperty::PositionProperty,
        3,
        false
    );

    for(std::size_t i = 0; i < refFrame.positions.size(); i++){
        refPositions->setPoint3(i, refFrame.positions[i]);
    }

    auto identifiers = std::make_shared<ParticleProperty>(
        currentFrame.ids.size(),
        ParticleProperty::IdentifierProperty,
        1,
        false
    );

    auto refIdentifiers = std::make_shared<ParticleProperty>(
        refFrame.ids.size(),
        ParticleProperty::IdentifierProperty,
        1,
        false
    );

    for(std::size_t i = 0; i < currentFrame.ids.size(); i++){
        identifiers->setInt(i, currentFrame.ids[i]);
        refIdentifiers->setInt(i, refFrame.ids[i]);
    }

    AtomicStrainModifier::AtomicStrainEngine engine(
        positions,
        currentFrame.simulationCell,
        refPositions.get(),
        refFrame.simulationCell,
        identifiers.get(),
        refIdentifiers.get(),
        _atomicStrainCutoff,
        _atomicStrainEliminateCellDeformation,
        _atomicStrainAssumeUnwrappedCoordinates,
        _atomicStrainCalcDeformationGradients,
        _atomicStrainCalcStrainTensors,
        _atomicStrainCalcNonaffineSquaredDisplacements
    );

    engine.perform();

    // Calculate summary stats
    double totalShear = 0.0;
    double totalVolumetric = 0.0;
    double maxShear = 0.0;
    int count = 0;
    auto shear = engine.shearStrains();
    auto volumetric = engine.volumetricStrains();
    size_t n = currentFrame.positions.size();
    for(size_t i=0; i<n; ++i){
         if(shear){
             double s = shear->getDouble(i);
             totalShear += s;
             if(s > maxShear) maxShear = s;
         }
         if(volumetric) totalVolumetric += volumetric->getDouble(i);
         count++;
    }

    json root;
    root["cutoff"] = _atomicStrainCutoff;
    root["num_invalid_particles"] = engine.numInvalidParticles();
    root["summary"] = {
        {"average_shear_strain", count > 0 ? totalShear / count : 0.0},
        {"average_volumetric_strain", count > 0 ? totalVolumetric / count : 0.0},
        {"max_shear_strain", maxShear}
    };

    if(!outputFilename.empty()){
        _jsonExporter.writeAtomicStrainMsgpack(engine, currentFrame.ids, outputFilename + "_atomic_strain.msgpack");
        spdlog::info("Atomic strain data written to {}_atomic_strain.msgpack", outputFilename);
        root["atomic_strain"] = json::array();
    }else{
        root["atomic_strain"] = json::array();
        auto shear = engine.shearStrains();
        auto volumetric = engine.volumetricStrains();
        auto strainProp = engine.strainTensors();
        auto defgrad = engine.deformationGradients();
        auto D2minProp = engine.nonaffineSquaredDisplacements();
        auto invalid = engine.invalidParticles();

        for(std::size_t i = 0; i < currentFrame.positions.size(); i++){
            json a;
            a["id"] = currentFrame.ids[i];
            a["shear_strain"] = shear ? shear->getDouble(i) : 0.0;
            a["volumetric_strain"] = volumetric ? volumetric->getDouble(i) : 0.0;

            if(strainProp){
                double xx = strainProp->getDoubleComponent(i, 0);
                double yy = strainProp->getDoubleComponent(i, 1);
                double zz = strainProp->getDoubleComponent(i, 2);
                double yz = strainProp->getDoubleComponent(i, 3);
                double xz = strainProp->getDoubleComponent(i, 4);
                double xy = strainProp->getDoubleComponent(i, 5);
                a["strain_tensor"] = { xx, yy, zz, xy, xz, yz };
            }
            
            if(defgrad){
                double xx = defgrad->getDoubleComponent(i, 0); 
                double yx = defgrad->getDoubleComponent(i, 1);
                double zx = defgrad->getDoubleComponent(i, 2);
                double xy = defgrad->getDoubleComponent(i, 3); 
                double yy = defgrad->getDoubleComponent(i, 4);
                double zy = defgrad->getDoubleComponent(i, 5); 
                double xz = defgrad->getDoubleComponent(i, 6);
                double yz = defgrad->getDoubleComponent(i, 7);
                double zz = defgrad->getDoubleComponent(i, 8);
                a["deformation_gradient"] = { xx, yx, zx, xy, yy, zy, xz, yz, zz };
            }

            if(D2minProp){
                a["D2min"] = D2minProp->getDouble(i);
            }else{
                a["D2min"] = nullptr;
            }

            if(invalid){
                a["invalid"] = (invalid->getInt(i) != 0);
            }else{
                a["invalid"] = false;
            }

            root["atomic_strain"].push_back(a);
        }
    }

    return root; 
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

    if(_coordinationAnalysisOnly){
        spdlog::info("Starting coordination analysis (cutoff = {}, bins = {})...", _coordinationCutoff, _coordinationRdfBins);
        CoordinationNumber cn;
        cn.setCutoff(_coordinationCutoff);

        CoordinationNumber::CoordinationAnalysisEngine engine(
            positions.get(),
            frame.simulationCell,
            _coordinationCutoff,
            _coordinationRdfBins
        );

        engine.perform();
        cn.transferComputationResults(&engine);

        const auto &rdfX = cn.rdfX();
        const auto &rdfY = cn.rdY();

        auto coordProp = engine.coordinationNumbers();
        std::vector<int> coord(frame.natoms);
        for(int i = 0; i < frame.natoms; i++){
            coord[i] = coordProp->getInt(i);
        }

        result["is_failed"] = false;
        result["cutoff"] = _coordinationCutoff;
        result["rdf"]["x"] = rdfX;
        result["rdf"]["y"] = rdfY;
        result["coordination"] = coord;
        if(!outputFile.empty()){
            std::string rdfPath = outputFile + "_rdf.msgpack";
            _jsonExporter.writeRdfMsgpack(rdfX, rdfY, rdfPath);
            spdlog::info("RDF data written to {}", rdfPath);
        }
        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time).count();
        result["total_time"] = duration;
        spdlog::debug("Coordination analysis time {} ms", duration);

        return result;
    }

    if(_atomicStrainEnabled){
        const LammpsParser::Frame &refFrame = _hasAtomicStrainReference ? _atomicStrainReferenceFrame : frame;
        json strainJson = computeAtomicStrain(frame, refFrame, positions.get(), outputFile);
        result["atomic_strain"] = strainJson;
        return result;
    }

    if(_elasticStrainEnabled){
        std::vector<Matrix3> preferredOrientations;
        preferredOrientations.push_back(Matrix3::Identity());

        auto structureTypes = std::make_shared<ParticleProperty>(frame.natoms, DataType::Int, 1, 0, true);

        ElasticStrainEngine engine(
            positions.get(),
            structureTypes.get(),
            frame.simulationCell,
            static_cast<LatticeStructureType>(_inputCrystalStructure),
            std::move(preferredOrientations),
            _elasticCalcDefGrad,
            _elasticCalcStrainTensors,
            _elasticLatticeConstant,
            _elasticCaRatio,
            _elasticPushForward
        );

        engine.perform();

        json strainJson;
        strainJson["elastic_strain"] = json::array();

        auto volProp = engine.volumetricStrains();
        auto strainProp = engine.strainTensors();
        auto defgradProp = engine.deformationGradients();

        for(std::size_t i = 0; i < frame.positions.size(); i++){
            json a;
            a["id"] = frame.ids[i];
            a["volumetric_strain"] = volProp ? volProp->getDouble(i) : 0.0;
            if(strainProp){
                double xx = strainProp->getDoubleComponent(i, 0);
                double yy = strainProp->getDoubleComponent(i, 1);
                double zz = strainProp->getDoubleComponent(i, 2);
                double yz = strainProp->getDoubleComponent(i, 3);
                double xz = strainProp->getDoubleComponent(i, 4);
                double xy = strainProp->getDoubleComponent(i, 5);
                a["strain_tensor"] = { xx, yy, zz, xy, xz, yz };
            }

            if(defgradProp){
                double fxx = defgradProp->getDoubleComponent(i, 0);
                double fyx = defgradProp->getDoubleComponent(i, 1);
                double fzx = defgradProp->getDoubleComponent(i, 2);
                double fxy = defgradProp->getDoubleComponent(i, 3);
                double fyy = defgradProp->getDoubleComponent(i, 4);
                double fzy = defgradProp->getDoubleComponent(i, 5);
                double fxz = defgradProp->getDoubleComponent(i, 6);
                double fyz = defgradProp->getDoubleComponent(i, 7);
                double fzz = defgradProp->getDoubleComponent(i, 8);
                a["deformation_gradient"] = { fxx, fyx, fzx, fxy, fyy, fzy, fxz, fyz, fzz };
            }

            strainJson["elastic_strain"].push_back(a);
        }

        result["is_failed"] = false;
        result["elastic_strain"] = strainJson;

        if(!outputFile.empty()){
            std::string path = outputFile + "_elastic_strain.json";
            std::ofstream ofs(path);
            ofs << std::setw(2) << strainJson << std::endl;
            ofs.close();
            spdlog::info("Elastic strain data written to {}", path);
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(
            end_time - start_time).count();
        result["total_time"] = duration;

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

        // Export full atoms data with positions and structure types
        _jsonExporter.writeAtomsSimpleMsgpack(frame, *structureAnalysis, &extractedStructureTypes, outputFile + "_atoms.msgpack");

        // Also export structure statistics separately
        _jsonExporter.writeStructureStatsMsgpack(*structureAnalysis, outputFile + "_structure_stats.msgpack");

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

json DislocationAnalysis::performGrainSegmentation(
    const LammpsParser::Frame &frame, 
    const StructureAnalysis& structureAnalysis, 
    const std::vector<int>& structureTypes, 
    const std::string& outputFile
){
    spdlog::info("Starting grain segmentation analysis...");
    
    json result;
    
    try {
        const auto& ctx = structureAnalysis.context();
        
        if (!ctx.ptmOrientation || !ctx.correspondencesCode) {
            spdlog::error("PTM orientation data not available. Grain segmentation requires PTM mode.");
            result["is_failed"] = true;
            result["error"] = "Grain segmentation requires PTM mode with orientation output enabled.";
            return result;
        }

        // Create shared pointers for the engine
        auto positions = std::make_shared<ParticleProperty>(
            frame.natoms, ParticleProperty::PositionProperty, 0, true);
        for (size_t i = 0; i < frame.positions.size() && i < static_cast<size_t>(frame.natoms); ++i) {
            positions->setPoint3(i, frame.positions[i]);
        }
        
        auto structures = std::make_shared<ParticleProperty>(
            frame.natoms, DataType::Int, 1, 0, false);
        for (size_t i = 0; i < structureTypes.size(); ++i) {
            structures->setInt(i, structureTypes[i]);
        }
        
        // Copy PTM orientation property (quaternions: x,y,z,w)
        auto orientations = std::make_shared<ParticleProperty>(
            frame.natoms, DataType::Double, 4, 0, false);
        for (size_t i = 0; i < static_cast<size_t>(frame.natoms); ++i) {
            for (int c = 0; c < 4; ++c) {
                orientations->setDoubleComponent(i, c, ctx.ptmOrientation->getDoubleComponent(i, c));
            }
        }
        
        // Copy correspondence codes
        auto correspondences = std::make_shared<ParticleProperty>(
            frame.natoms, DataType::Int64, 1, 0, false);
        {
            auto* src = reinterpret_cast<const uint64_t*>(ctx.correspondencesCode->data());
            auto* dst = reinterpret_cast<uint64_t*>(correspondences->data());
            std::copy(src, src + frame.natoms, dst);
        }

        spdlog::info("Running GrainSegmentationEngine1 (building neighbor graph and dendrogram)...");
        
        // Engine1: Build neighbor graph, compute disorientations, create dendrogram
        auto engine1 = std::make_shared<GrainSegmentationEngine1>(
            positions,
            structures,
            orientations,
            correspondences,
            &frame.simulationCell,
            _grainHandleCoherentInterfaces,
            _grainOutputBonds
        );
        
        engine1->perform();
        
        spdlog::info("GrainSegmentationEngine1 complete. Dendrogram size: {}", engine1->dendrogram().size());
        spdlog::info("Suggested merging threshold: {:.4f}", engine1->suggestedMergingThreshold());

        // Engine2: Cluster atoms using the dendrogram threshold
        spdlog::info("Running GrainSegmentationEngine2 (clustering atoms into grains)...");
        
        GrainSegmentationEngine2 engine2(
            engine1,
            _grainAdoptOrphanAtoms,
            static_cast<size_t>(_grainMinAtomCount),
            true  // colorParticlesByGrain
        );
        
        engine2.perform();
        
        spdlog::info("Found {} grains", engine2.grainCount());

        // Extract grain IDs for each atom
        auto atomClusters = engine2.atomClusters();
        std::vector<int> grainIds(frame.natoms, 0);
        for (size_t i = 0; i < static_cast<size_t>(frame.natoms); ++i) {
            grainIds[i] = atomClusters->getInt(i);
        }

        // Build result JSON
        json grainData;
        grainData["grain_count"] = static_cast<int>(engine2.grainCount());
        grainData["merging_threshold"] = engine1->suggestedMergingThreshold();
        grainData["grains"] = json::array();
        
        for (const auto& grain : engine2.grains()) {
            json grainInfo;
            grainInfo["id"] = grain.id;
            grainInfo["size"] = grain.size;
            grainInfo["orientation"] = {
                grain.orientation.x(), 
                grain.orientation.y(), 
                grain.orientation.z(), 
                grain.orientation.w()
            };
            grainData["grains"].push_back(grainInfo);
        }

        // Export atoms msgpack in AtomisticExporter-compatible format
        // Format: map<"Grain_X", array<{id, pos[3]}>>
        std::string msgpackPath = outputFile + "_grains.msgpack";
        {
            std::ofstream of(msgpackPath, std::ios::binary);
            MsgpackWriter w(of);
            
            // Count atoms per grain
            std::map<int, uint32_t> grainCounts;
            for (int gid : grainIds) {
                grainCounts[gid]++;
            }
            
            // Write map header (number of grains + 1 for "Unassigned")
            uint32_t numGroups = static_cast<uint32_t>(grainCounts.size());
            w.write_map_header(numGroups);
            
            // Get sorted grain IDs for deterministic output
            std::vector<int> sortedGrainIds;
            for (const auto& kv : grainCounts) {
                sortedGrainIds.push_back(kv.first);
            }
            std::sort(sortedGrainIds.begin(), sortedGrainIds.end());
            
            // Write each grain group
            for (int gid : sortedGrainIds) {
                // Key: "Grain_X" or "Unassigned" for gid=0
                std::string key = (gid == 0) ? "Unassigned" : ("Grain_" + std::to_string(gid));
                w.write_key(key);
                
                // Array of atoms
                w.write_array_header(grainCounts[gid]);
                
                // Write atoms belonging to this grain
                for (size_t i = 0; i < static_cast<size_t>(frame.natoms); ++i) {
                    if (grainIds[i] != gid) continue;
                    
                    // atom object: {id, pos}
                    w.write_map_header(2);
                    w.write_key("id");
                    w.write_uint(static_cast<uint64_t>(i));
                    w.write_key("pos");
                    w.write_array_header(3);
                    if (i < frame.positions.size()) {
                        const auto& p = frame.positions[i];
                        w.write_double(p.x());
                        w.write_double(p.y()); 
                        w.write_double(p.z());
                    } else {
                        w.write_double(0.0);
                        w.write_double(0.0);
                        w.write_double(0.0);
                    }
                }
            }
            
            of.flush();
        }
        
        spdlog::info("Exported atoms msgpack to: {}", msgpackPath);

        // Export grain metadata msgpack
        std::string metaPath = outputFile + "_grains_meta.msgpack";
        std::vector<uint8_t> metaMsgpack = json::to_msgpack(grainData);
        std::ofstream metaFile(metaPath, std::ios::binary);
        metaFile.write(reinterpret_cast<const char*>(metaMsgpack.data()), metaMsgpack.size());
        metaFile.close();
        
        spdlog::info("Exported grain metadata msgpack to: {}", metaPath);

        result = grainData;
        result["is_failed"] = false;
        
        spdlog::info("Grain segmentation completed. Found {} grains.", engine2.grainCount());

    } catch (const std::exception& e) {
        result["is_failed"] = true;
        result["error"] = std::string("Grain segmentation failed: ") + e.what();
        spdlog::error("Grain segmentation error: {}", e.what());
    }

    return result;
}

}
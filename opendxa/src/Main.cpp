#include "Includes.hpp"
#include "parser/ParserStream.hpp"
#include "utils/Timer.hpp"
#include "core/StackingFaults.hpp"

void printHelp()
{
	fprintf(stderr, "Dislocation extraction algorithm (DXA)\n");
	fprintf(stderr, "Usage: DXA [options] cna_cutoff inputfile outputfile\n\n");
	fprintf(stderr, "Parameters:\n\n");
	fprintf(stderr, "    cna_cutoff: Cutoff radius used for the common neighbor analysis\n");
	fprintf(stderr, "    inputfile : Input atoms file (LAMMPS, IMD, MD++, or DXA formats)\n");
	fprintf(stderr, "    outputfile: Output dislocations file (ParaView VTK file)\n");
	fprintf(stderr, "\nOutput options:\n\n");
	fprintf(stderr, "    -dumpsurface FILE     :  Dump crystal defect surface to a VTK file\n");
	fprintf(stderr, "    -dumpsurfacecap FILE  :  Dump PBC cap of defect surface to a VTK file\n");
	fprintf(stderr, "    -dumpsf FILE          :  Dump stacking fault planes to a VTK file\n");
	fprintf(stderr, "    -dumpcell FILE        :  Dump simulation cell geometry to a VTK file\n");
	fprintf(stderr, "    -dumpmesh FILE        :  Dump interface mesh to a VTK file\n");
	fprintf(stderr, "    -dumpatoms FILE       :  Dump processed atoms to a LAMMPS dump file\n");
	fprintf(stderr, "\nControl options:\n\n");
	fprintf(stderr, "    -pbc X Y Z            :  Activates periodic boundary conditions (X,Y,Z = 0/1)\n");
	fprintf(stderr, "    -offset X Y Z         :  Adds an offset to the atomic positions prior to analysis\n");
	fprintf(stderr, "    -scale X Y Z          :  Scales the simulation cell prior to analysis\n");
	fprintf(stderr, "    -maxcircuitsize N     :  Maximum Burgers circuit length during first tracing phase (default N=%i)\n", DEFAULT_MAX_BURGERS_CIRCUIT_SIZE);
	fprintf(stderr, "    -extcircuitsize M     :  Maximum Burgers circuit length during second tracing phase (default M=%i)\n", DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE);
	fprintf(stderr, "\nSmoothing options:\n\n");
	fprintf(stderr, "    -smoothsurface N      :  Smoothing level for defect surface (default N=%i)\n", DEFAULT_SURFACE_SMOOTHING_LEVEL);
	fprintf(stderr, "    -smoothlines N        :  Smoothing level for dislocation lines (default N=%i)\n", DEFAULT_LINE_SMOOTHING_LEVEL);
	fprintf(stderr, "    -coarsenlines N       :  Coarsening level for dislocation lines (default N=%i)\n", DEFAULT_LINE_COARSENING_LEVEL);
	fprintf(stderr, "    -flattensf X          :  Flattening level for stacking fault planes (X=[0,1], default X=%.1f)\n", DEFAULT_SF_FLATTEN_LEVEL);
	fprintf(stderr, "\n");
}

int main(int argc, char* argv[])
{
	string dumpMeshFile;
	string dumpAtomsFile;
	string dumpSFPlanesFile;
	string dumpSurfaceFile;
	string dumpSurfaceCapFile;
	string dumpCellFile;

	int pbcX = 0;
	int pbcY = 0;
	int pbcZ = 0;
	Vector3 scaleFactors(1,1,1);

	int maxBurgersCircuitSize = DEFAULT_MAX_BURGERS_CIRCUIT_SIZE;
	int maxExtendedBurgersCircuitSize = DEFAULT_MAX_EXTENDED_BURGERS_CIRCUIT_SIZE;
	int surfaceSmoothingLevel = DEFAULT_SURFACE_SMOOTHING_LEVEL;
	int lineSmoothingLevel = DEFAULT_LINE_SMOOTHING_LEVEL;
	int lineCoarseningLevel = DEFAULT_LINE_COARSENING_LEVEL;
	FloatType sfFlattenLevel = DEFAULT_SF_FLATTEN_LEVEL;
	Vector3 atomOffset = NULL_VECTOR;

	// The following sets the locale to the standard "C" locale, which is independent of the user's system settings.
	locale::global(locale::classic());

	// Parse command line parameters.
	int iarg = 1;
	while(iarg < argc) {
		if(strcmp(argv[iarg], "-dumpmesh") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpMeshFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-dumpatoms") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpAtomsFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-dumpsf") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpSFPlanesFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-dumpsurface") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpSurfaceFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-dumpsurfacecap") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpSurfaceCapFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-dumpcell") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			dumpCellFile = argv[iarg+1];
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-pbc") == 0) {
			if(iarg >= argc-3) {
				printHelp();
				return 1;
			}
			pbcX = atoi(argv[iarg+1]);
			pbcY = atoi(argv[iarg+2]);
			pbcZ = atoi(argv[iarg+3]);
			iarg += 4;
		}
		else if(strcmp(argv[iarg], "-scale") == 0) {
			if(iarg >= argc-3) {
				printHelp();
				return 1;
			}
			scaleFactors.X = atof(argv[iarg+1]);
			scaleFactors.Y = atof(argv[iarg+2]);
			scaleFactors.Z = atof(argv[iarg+3]);
			iarg += 4;
		}
		else if(strcmp(argv[iarg], "-maxcircuitsize") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			maxBurgersCircuitSize = atoi(argv[iarg+1]);
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-extcircuitsize") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			maxExtendedBurgersCircuitSize = atoi(argv[iarg+1]);
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-offset") == 0) {
			if(iarg >= argc-3) {
				printHelp();
				return 1;
			}
			atomOffset.X = atof(argv[iarg+1]);
			atomOffset.Y = atof(argv[iarg+2]);
			atomOffset.Z = atof(argv[iarg+3]);
			iarg += 4;
		}
		else if(strcmp(argv[iarg], "-flattensf") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			sfFlattenLevel = atof(argv[iarg+1]);
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-smoothsurface") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			surfaceSmoothingLevel = atoi(argv[iarg+1]);
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-smoothlines") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			lineSmoothingLevel = atoi(argv[iarg+1]);
			iarg += 2;
		}
		else if(strcmp(argv[iarg], "-coarsenlines") == 0) {
			if(iarg >= argc-1) {
				printHelp();
				return 1;
			}
			lineCoarseningLevel = atoi(argv[iarg+1]);
			iarg += 2;
		}
		else if(argv[iarg][0] == '-') {
			fprintf(stderr, "Invalid command line option: %s\n", argv[iarg]);
			return 1;
		}
		else break;
	}
	if(iarg + 3 != argc) {
		printHelp();
		return 1;
	}

	try {
		double cnaCutoff;
		if(sscanf(argv[iarg], "%lg", &cnaCutoff) != 1 || cnaCutoff <= 0.0) {
			printHelp();
			DXABase::raiseError("Invalid CNA cutoff radius: %s", argv[1]);
		}

		// Create search object.
		DXAStackingFaults searcher(cerr, cerr);
		// Initialize control parameters.
		searcher.setCNACutoff((FloatType)cnaCutoff);
		searcher.setPBC(pbcX, pbcY, pbcZ);
		searcher.setMaximumBurgersCircuitSize(maxBurgersCircuitSize);
		searcher.setMaximumExtendedBurgersCircuitSize(maxExtendedBurgersCircuitSize);

		// Open input file for reading.
		ifstream file_instream;
		istream* instream;
		const char* inputFilename = argv[iarg+1];
		if(strcmp(inputFilename, "-") == 0) {
			instream = &cin;
#if DISLOCATION_TRACE_OUTPUT >= 2
		searcher.MsgLogger() << "Reading input data from stdin." << endl;
#endif
		}
		else {
#if DISLOCATION_TRACE_OUTPUT >= 2
		searcher.MsgLogger() << "Reading input file '" << inputFilename << "'" << endl;
#endif
			file_instream.open(inputFilename);
			instream = &file_instream;
			if(!file_instream.is_open())
				DXABase::raiseError("Failed to open input file for reading. Filename was '%s'.", inputFilename);
		}
		ParserStream parserStream(*instream);

		// Parse file.
		ParserFileType fileType = searcher.readAtomsFile(parserStream);

#if DISLOCATION_TRACE_OUTPUT >= 2
		searcher.MsgLogger() << "CNA cutoff radius: " << searcher.getCNACutoff() << endl;
#endif

		// Scale simulation cell if requested by the user.
		if(scaleFactors != Vector3(1,1,1))
			searcher.transformSimulationCell(Matrix3(scaleFactors.X, 0, 0, 0, scaleFactors.Y, 0, 0, 0, scaleFactors.Z));

		// Make sure all input atoms are wrapped at periodic boundary conditions.
		searcher.wrapInputAtoms(atomOffset);

		Timer analysisTimer;

		// Build nearest neighbor lists.
		searcher.buildNearestNeighborLists();

		// Perform common neighbor analysis to identify crystalline atoms.
		searcher.performCNA();

		// Order the neighbors of crystalline atoms.
		searcher.orderCrystallineAtoms();

		// Cluster crystalline atoms.
		searcher.clusterAtoms();

		// Create the nodes of the interface mesh.
		searcher.createInterfaceMeshNodes();

		// Force creation of stacking fault basal plane edges.
		if(dumpSFPlanesFile.empty() == false) {
			if(!searcher.createStackingFaultEdges())
				dumpSFPlanesFile.clear();
		}

		// Dump processed atoms to output file.
		if(dumpAtomsFile.empty() == false) {
			ofstream dump_atoms_outstream;
			if(dumpAtomsFile.empty() == false) {
				dump_atoms_outstream.open(dumpAtomsFile.c_str(), ios::out);
				if(!dump_atoms_outstream.is_open())
					DXABase::raiseError("Failed to open atoms file for writing. Filename was '%s'.", dumpAtomsFile.c_str());
			}
			searcher.writeAtomsDumpFile(dump_atoms_outstream);
		}

		// Create the facets of the interface mesh.
		searcher.createInterfaceMeshFacets();

#ifdef DEBUG_DISLOCATIONS
		// Check the generated mesh.
		searcher.validateInterfaceMesh();
#endif

		// Mark stacking fault basal plane edges.
		if(dumpSFPlanesFile.empty() == false) {
			// This call has been added to solve situation shown in "sfcontour10a.png".
			if(!searcher.createStackingFaultEdges())
				dumpSFPlanesFile.clear();
		}

		// Prepare stacking fault planes.
		if(dumpSFPlanesFile.empty() == false)
			searcher.findStackingFaultPlanes();

		// Trace Burgers circuits on the interface mesh.
		searcher.traceDislocationSegments();

		// Dump interface mesh.
		if(dumpMeshFile.empty() == false) {
			ofstream dumpmesh_outstream;
			dumpmesh_outstream.open(dumpMeshFile.c_str(), ios::out);
			if(!dumpmesh_outstream.is_open())
				DXABase::raiseError("Failed to open interface mesh file for writing. Filename was '%s'.", dumpMeshFile.c_str());
			searcher.writeInterfaceMeshFile(dumpmesh_outstream);
		}

		if(dumpSurfaceFile.empty() == false) {
			// Generate defect surface mesh for output.
			searcher.generateOutputMesh();

			// Smooth the interface mesh for output.
			searcher.smoothOutputSurface(surfaceSmoothingLevel);
		}

		// Connect stacking faults to bordering dislocation lines.
		if(dumpSFPlanesFile.empty() == false)
			searcher.findSFDislocationContours();

		// Smooth dislocation lines mesh.
		searcher.smoothDislocationSegments(lineSmoothingLevel, lineCoarseningLevel);

		// Create triangulation of stacking fault planes.
		if(dumpSFPlanesFile.empty() == false)
			searcher.finishStackingFaults(sfFlattenLevel);

#if DISLOCATION_TRACE_OUTPUT >= 1
		searcher.MsgLogger() << "Total analysis time (including CNA): " << analysisTimer.elapsedTime() << " sec." << endl;
#endif

		// Write stacking faults to file.
		if(dumpSFPlanesFile.empty() == false) {
			ofstream dump_outstream;
			dump_outstream.open(dumpSFPlanesFile.c_str(), ios::out);
			if(!dump_outstream.is_open())
				DXABase::raiseError("Failed to open stacking fault file for writing. Filename was '%s'.", dumpSFPlanesFile.c_str());
			searcher.writeStackingFaults(dump_outstream);
			//searcher.writeStackingFaultPolylines(dump_outstream);
		}

		// Write crystal defect surface to file.
		if(dumpSurfaceFile.empty() == false) {
			searcher.finishOutputSurface(dumpSurfaceCapFile.empty() == false);

			ofstream dump_outstream;
			dump_outstream.open(dumpSurfaceFile.c_str(), ios::out);
			if(!dump_outstream.is_open())
				DXABase::raiseError("Failed to open surface file for writing. Filename was '%s'.", dumpSurfaceFile.c_str());
			searcher.writeOutputMeshFile(dump_outstream);

			if(dumpSurfaceCapFile.empty() == false) {
				ofstream dump_outstream;
				dump_outstream.open(dumpSurfaceCapFile.c_str(), ios::out);
				if(!dump_outstream.is_open())
					DXABase::raiseError("Failed to open cap surface file for writing. Filename was '%s'.", dumpSurfaceCapFile.c_str());
				searcher.writeOutputMeshCapFile(dump_outstream);
			}
		}

		// Write simulation cell geometry to file.
		if(dumpCellFile.empty() == false) {
			ofstream dump_outstream;
			dump_outstream.open(dumpCellFile.c_str(), ios::out);
			if(!dump_outstream.is_open())
				DXABase::raiseError("Failed to open simulation cell file for writing. Filename was '%s'.", dumpCellFile.c_str());
			searcher.writeSimulationCellFileVTK(dump_outstream);
		}

		// Wrap dislocation lines at periodic boundaries.
		searcher.wrapDislocationSegments();

		// Write dislocation lines to output file.
		ofstream file_outstream;
		ostream* outstream;
		const char* outputFilename = argv[iarg+2];
		if(strcmp(outputFilename, "-") == 0) {
			outstream = &cout;
		}
		else {
			file_outstream.open(outputFilename, ios::out);
			outstream = &file_outstream;
			if(!file_outstream.is_open())
				DXABase::raiseError("Failed to open dislocation output file for writing. Filename was '%s'.", outputFilename);
		}
		// Write results to output file.
		searcher.writeDislocationsVTKFile(*outstream);

#if 0
		// Calculate scalar dislocation density and density tensor.
		double dislocationDensity = 0.0;
		double dislocationDensityTensor[3][3] = {0.0};

		const std::vector<DislocationSegment*>& segments = searcher.getSegments();
		for(int segmentIndex = 0; segmentIndex < segments.size(); segmentIndex++) {

			DislocationSegment* segment = segments[segmentIndex];
			const std::deque<Point3>& line = segment->line;

			//searcher.MsgLogger() << line.front() << " -> " << line.back() << "   diff=" << (line.back()-line.front()) << endl;

			for(std::deque<Point3>::const_iterator p1 = line.begin(), p2 = line.begin() + 1; p2 < line.end(); ++p1, ++p2) {
				Vector3 delta = (*p2) - (*p1);
				dislocationDensity += Length(delta);
				for(int i = 0; i < 3; i++)
					for(int j = 0; j < 3; j++)
						dislocationDensityTensor[i][j] += delta[i] * segment->burgersVectorWorld[j];
			}
		}

		double volume = searcher.getSimulationCell().determinant();
		dislocationDensity /= volume;
		for(int i = 0; i < 3; i++)
			for(int j = 0; j < 3; j++)
				dislocationDensityTensor[i][j] /= volume;

		searcher.MsgLogger() << "Dislocation density: " << dislocationDensity << endl;
		searcher.MsgLogger() << "Dislocation density tensor:" << endl;
		for(int i = 0; i < 3; i++) {
			searcher.MsgLogger() << dislocationDensityTensor[i][0] << " " << dislocationDensityTensor[i][1] << " " << dislocationDensityTensor[i][2] << " " << endl;
		}

#endif

		// Release memory;
		searcher.cleanup();
	}
	catch(const std::bad_alloc& ex) {
		fprintf(stderr, "ERROR: Out of memory.\n");
		return 1;
	}
	catch(const exception& ex) {
		fprintf(stderr, "ERROR: %s\n", ex.what());
		return 1;
	}

	return 0;
}

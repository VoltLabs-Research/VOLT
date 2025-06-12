#include <opendxa/core/Clustering.hpp>
#include <opendxa/utils/CutoffEstimator.hpp>

void DXAClustering::readLAMMPSAtomsFile(ParserStream &stream){
	std::cout << "Parsing LAMMPS dump file." << std::endl;
	int numRealInputAtoms = -1;
	int columnPosX = -1;
	int columnPosY = -1;
	int columnPosZ = -1;
	int columnId = -1;
	
	int numberOfColumns = 0;
	bool reducedCoordinates = false;

	while(!stream.eof()){
		const std::string &currentLine = stream.line();
		if(currentLine.rfind("ITEM: NUMBER OF ATOMS", 0) == 0){
			stream.readline();
			try{
				numRealInputAtoms = std::stoi(stream.line());
			}catch(const std::exception &){
				raiseError("File parsing error. Invalid number of atoms (line %d): %s", stream.lineNumber(), stream.line().c_str());
			}
			
			if(numRealInputAtoms < 0 || numRealInputAtoms > 1e9){
				raiseError("File parsing error. Invalid number of atoms (line %d): %s", stream.lineNumber(), stream.line().c_str());
			}
		}else if(currentLine.rfind("ITEM: ATOMS", 0) == 0){
			if(numRealInputAtoms == -1){
				raiseError("File parsing error. Found 'ITEM: ATOMS' before 'ITEM: NUMBER OF ATOMS'.");
			}

			std::stringstream headerStream(currentLine);
			std::string itemKeyword;
			std::string atomsKeyword;

			headerStream >> itemKeyword >> atomsKeyword;

			std::string columnName;
			std::vector<std::string> columns;

			while(headerStream >> columnName){
				columns.push_back(columnName);
			}
			numberOfColumns = columns.size();
			if(numberOfColumns == 0) raiseError("File parsing error. LAMMPS dump file does not contain column identifiers.");

			for(int i = 0; i < numberOfColumns; ++i){
				const auto &col = columns[i];
				if(col == "x"){
					columnPosX = i;
				}else if(col == "y"){
					columnPosY = i;
				}else if(col == "z"){
					columnPosZ = i;
				}else if(col == "xs"){
					columnPosX = i;
					reducedCoordinates = true;
				}else if(col == "ys"){
					columnPosY = i;
					reducedCoordinates = true;
				}else if(col == "zs"){
					columnPosZ = i;
					reducedCoordinates = true;
				}else if(col == "id"){
					columnId = i;
				}
			}

            if(columnPosX == -1) raiseError("File parsing error. Input file does not contain X coordinate column.");
            if(columnPosY == -1) raiseError("File parsing error. Input file does not contain Y coordinate column.");
            if(columnPosZ == -1) raiseError("File parsing error. Input file does not contain Z coordinate column.");

			std::cout << "Reading " << std::to_string(numRealInputAtoms) << " atoms at timestep " << timestep << " from input file (required memory: " << std::to_string(numRealInputAtoms * sizeof(InputAtom) / 1024 / 1024) << " mbyte)." << std::endl;
			if(reducedCoordinates){
				std::cout << "LAMMPS file contains reduced atom coordinates." << std::endl;
			}
			inputAtoms.reserve(numRealInputAtoms);
			for(int i = 0; i < numRealInputAtoms; ++i){
				stream.readline();
				std::stringstream dataStream(stream.line());
				std::vector<std::string> tokens(numberOfColumns);
				for(int j = 0; j < numberOfColumns; ++j){
					if(!(dataStream >> tokens[j])){
                        raiseError("File parsing error. Unexpected end of line (line %i). Found %d columns, expected %d.", stream.lineNumber(), j, numberOfColumns);
					}
				}

				Point3 pos(ORIGIN);
				int id = i +1 ;
				try{
					pos.X = std::stod(tokens[columnPosX]);
					pos.Y = std::stod(tokens[columnPosY]);
					pos.Z = std::stod(tokens[columnPosZ]);

					if(columnId != -1){
						id = std::stoi(tokens[columnId]);
					}
				}catch(const std::exception &){
					raiseError("File parsing error. Invalid numeric value on line %d: %s", stream.lineNumber(), stream.line().c_str());
				}

				if(reducedCoordinates){
					pos = reducedToAbsolute(pos);
				}

				addInputAtom(pos, id);
			}

			if(!cnaCutoff){
				cnaCutoff = estimateCutoff(getInputAtoms(), getSimulationCell());
			}

			setupSimulationCell(cnaCutoff);
			return;
		}else if(currentLine.rfind("ITEM:", 0) == 0){
			if(!readSimulationCell(stream)){
				while(!stream.eof()){
					stream.readline();
					if(stream.line().rfind("ITEM", 0) == 0) break;
				}
				continue;
			}
		}
		stream.readline();
	}
}
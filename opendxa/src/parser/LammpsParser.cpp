#include "core/Clustering.hpp"
#include "utils/CutoffEstimator.hpp"

/******************************************************************************
* Reads the atomic coordinates from the input file in LAMMPS dump format.
******************************************************************************/
void DXAClustering::readLAMMPSAtomsFile(ParserStream& stream)
{
#if DISLOCATION_TRACE_OUTPUT >= 1
	MsgLogger() << "Parsing LAMMPS dump file." << endl;
#endif

	setlocale(LC_NUMERIC, "C");
	int numRealInputAtoms;
	do {
		do {
			if(stream.line().find("ITEM: NUMBER OF ATOMS") != string::npos) {
				// Parse number of atoms.
				if(sscanf(stream.readline().c_str(), "%u", &numRealInputAtoms) != 1 || numRealInputAtoms < 0 || numRealInputAtoms > 1e9)
					raiseError("File parsing error. Invalid number of atoms (line %d): %s", stream.lineNumber(), stream.line().c_str());
				break;
			}
			else if(stream.line().find("ITEM: ATOMS") != string::npos) {
				// Parse column names.
				int columnPosx = -1;
				int columnPosy = -1;
				int columnPosz = -1;
				int columnId = -1;
				bool reducedCoordinates = false;
				string::const_iterator tokenBegin = stream.line().begin() + 11;
				int numberOfColumns = 0;
				while(tokenBegin != stream.line().end()) {
					while(tokenBegin != stream.line().end() && (*tokenBegin == ' ' || *tokenBegin == '\t')) ++tokenBegin;
					if(tokenBegin == stream.line().end()) break;
					string::const_iterator tokenEnd = tokenBegin + 1;
					while(tokenEnd != stream.line().end() && *tokenEnd != ' ' && *tokenEnd != '\t') ++tokenEnd;
					string columnName(tokenBegin, tokenEnd);
					if(columnName == "x") columnPosx = numberOfColumns;
					else if(columnName == "y") columnPosy = numberOfColumns;
					else if(columnName == "z") columnPosz = numberOfColumns;
					else if(columnName == "xs") { columnPosx = numberOfColumns; reducedCoordinates = true; }
					else if(columnName == "ys") { columnPosy = numberOfColumns; reducedCoordinates = true; }
					else if(columnName == "zs") { columnPosz = numberOfColumns; reducedCoordinates = true; }
					else if(columnName == "id") columnId = numberOfColumns;
					tokenBegin = tokenEnd;
					numberOfColumns++;
				}
				if(numberOfColumns == 0) raiseError("File parsing error. LAMMPS dump file does not contain column identifiers. File format is too old.");
				if(columnPosx == -1) raiseError("File parsing error. Input file does not contain X coordinate column.");
				if(columnPosy == -1) raiseError("File parsing error. Input file does not contain Y coordinate column.");
				if(columnPosz == -1) raiseError("File parsing error. Input file does not contain Z coordinate column.");

#if DISLOCATION_TRACE_OUTPUT >= 1
				MsgLogger() << "Reading " << numRealInputAtoms << " atoms at timestep " << timestep << " from input file (required memory: " << (numRealInputAtoms*sizeof(InputAtom)/1024/1024) << " mbyte)." << endl;
				if(reducedCoordinates)
					MsgLogger() << "LAMMPS file contains reduced atom coordinates." << endl;
#endif
				inputAtoms.reserve(numRealInputAtoms);

				// Parse one atom per line.
				for(int i = 0; i < numRealInputAtoms; i++) {
					stream.readline();

					Point3 pos(ORIGIN);
					int id = i+1;

					string::const_iterator tokenBegin = stream.line().begin();
					int columnIndex = 0;
					while(tokenBegin != stream.line().end()) {
						while(tokenBegin != stream.line().end() && (*tokenBegin == ' ' || *tokenBegin == '\t')) ++tokenBegin;
						if(tokenBegin == stream.line().end()) break;
						string::const_iterator tokenEnd = tokenBegin + 1;
						while(tokenEnd != stream.line().end() && *tokenEnd != ' ' && *tokenEnd != '\t') ++tokenEnd;
						string token(tokenBegin, tokenEnd);
						if(columnPosx == columnIndex) {
							if(sscanf(token.c_str(), FLOAT_SCANF_STRING_1, &pos.X) != 1)
								raiseError("File parsing error. Invalid X coordinate (line %d, column %d): %s", stream.lineNumber(), columnIndex, stream.line().c_str());
						}
						else if(columnPosy == columnIndex) {
							if(sscanf(token.c_str(), FLOAT_SCANF_STRING_1, &pos.Y) != 1)
								raiseError("File parsing error. Invalid Y coordinate (line %d, column %d): %s", stream.lineNumber(), columnIndex, stream.line().c_str());
						}
						else if(columnPosz == columnIndex) {
							if(sscanf(token.c_str(), FLOAT_SCANF_STRING_1, &pos.Z) != 1)
								raiseError("File parsing error. Invalid Z coordinate (line %d, column %d): %s", stream.lineNumber(), columnIndex, stream.line().c_str());
						}
						else if(columnId == columnIndex) {
							if(sscanf(token.c_str(), "%u", &id) != 1)
								raiseError("File parsing error. Invalid atom ID (line %d, column %d): %s", stream.lineNumber(), columnIndex, stream.line().c_str());
						}
						tokenBegin = tokenEnd;
						columnIndex++;
					}
					if(columnIndex != numberOfColumns)
						raiseError("File parsing error. Unexpected end of line (line %i).", stream.lineNumber());

					if(reducedCoordinates)
						pos = reducedToAbsolute(pos);

					addInputAtom(pos, id);
				}

				if(!cnaCutoff){
					double estimatedCutoff = estimateCutoff(getInputAtoms(), getSimulationCell());
					cnaCutoff = estimatedCutoff;
				}

				setupSimulationCell(cnaCutoff);
				// Stop parsing here
				return;
			}
			else if(stream.line().find("ITEM:") != string::npos) {
				// Let the base class parse the simulation cell geometry.
				if(!readSimulationCell(stream)) {
					// Skip lines up to next ITEM:
					while(!stream.eof()) {
						stream.readline();
						if(stream.line().find("ITEM:") != string::npos) break;
					}
				}
				else break;
			}
			else if(stream.line().find_first_not_of(" \t\n\r") == string::npos) {
				// Skip empty lines
				break;
			}
			else {
				raiseError("File parsing error. Invalid line %d in file: %s", stream.lineNumber(), stream.line().c_str());
			}
		}
		while(!stream.eof());

		// Parse next line.
		stream.readline();
	}
	while(!stream.eof());
}

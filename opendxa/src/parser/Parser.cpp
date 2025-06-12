#include <opendxa/core/Clustering.hpp>

/******************************************************************************
* Reads the atomic coordinates from the input file.
******************************************************************************/
ParserFileType DXAClustering::readAtomsFile(ParserStream& stream)
{
	// Parse first line.
	stream.readline();
	if(stream.eof())
		raiseError("Invalid input file. File contains only a single text line.");

	// Perform auto-detection of file format.
	// Inspect first line of input file.
	if(stream.line().find("ITEM: TIMESTEP") != string::npos) {
		readLAMMPSAtomsFile(stream);
		return PARSER_FILETYPE_LAMMPS;
	}
	raiseError("Invalid input file. File format could not be recognized.");
	return (ParserFileType)0;
}

/******************************************************************************
* Adds an atom to the internal array.
******************************************************************************/
InputAtom& DXAClustering::addInputAtom(const Point3& pos, int id)
{
	InputAtom atom;
	atom.tag = id;
	atom.flags = (1 << ATOM_IS_LOCAL_ATOM);
	atom.cnaType = UNDEFINED;
	atom.numNeighbors = 0;
	atom.nextInBin = NULL;
	atom.pos = pos;
	inputAtoms.push_back(atom);

	numLocalInputAtoms++;

	return inputAtoms.back();
}


/******************************************************************************
* Applies the given affine transformation to the atoms and the simulation cell.
******************************************************************************/
void DXAClustering::transformSimulationCell(const Matrix3& tm)
{
#pragma omp parallel for
	for(int i = 0; i < inputAtoms.size(); i++) {
		Point3& p = inputAtoms[i].pos;
		p = simulationCellOrigin + tm * (p - simulationCellOrigin);
	}
	simulationCell = tm * simulationCell;
	setupSimulationCell(cnaCutoff);
}

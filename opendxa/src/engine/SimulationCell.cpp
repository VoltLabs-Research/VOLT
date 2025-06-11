#include "engine/AnalysisEnvironment.hpp"

Vector3 AnalysisEnvironment::wrapVector(const Vector3& v) const{
	Vector3 result = v;
	Vector3 rv = reciprocalSimulationCell * v;
	while(rv.X > +0.5 && pbc[0]) { rv.X -= 1.0; result -= simulationCell.column(0); }
	while(rv.X < -0.5 && pbc[0]) { rv.X += 1.0; result += simulationCell.column(0); }
	while(rv.Y > +0.5 && pbc[1]) { rv.Y -= 1.0; result -= simulationCell.column(1); }
	while(rv.Y < -0.5 && pbc[1]) { rv.Y += 1.0; result += simulationCell.column(1); }
	while(rv.Z > +0.5 && pbc[2]) { rv.Z -= 1.0; result -= simulationCell.column(2); }
	while(rv.Z < -0.5 && pbc[2]) { rv.Z += 1.0; result += simulationCell.column(2); }
	return result;
}

Vector3 AnalysisEnvironment::wrapReducedVector(Vector3 rv) const{
	while(rv.X > +0.5 && pbc[0]) { rv.X -= 1.0; }
	while(rv.X < -0.5 && pbc[0]) { rv.X += 1.0; }
	while(rv.Y > +0.5 && pbc[1]) { rv.Y -= 1.0; }
	while(rv.Y < -0.5 && pbc[1]) { rv.Y += 1.0; }
	while(rv.Z > +0.5 && pbc[2]) { rv.Z -= 1.0; }
	while(rv.Z < -0.5 && pbc[2]) { rv.Z += 1.0; }
	return rv;
}

bool AnalysisEnvironment::isWrappedVector(const Vector3& v) const{
	Vector3 rv = reciprocalSimulationCell * v;
	if(pbc[0] && fabs(rv.X) > 0.5) return true;
	if(pbc[1] && fabs(rv.Y) > 0.5) return true;
	if(pbc[2] && fabs(rv.Z) > 0.5) return true;
	return false;
}

bool AnalysisEnvironment::isReducedWrappedVector(const Vector3& v) const{
	if(pbc[0] && fabs(v.X) > 0.5) return true;
	if(pbc[1] && fabs(v.Y) > 0.5) return true;
	if(pbc[2] && fabs(v.Z) > 0.5) return true;
	return false;
}

Vector3I AnalysisEnvironment::periodicImage(const Point3& p) const{
	Vector3 rp = reciprocalSimulationCell * (p - simulationCellOrigin);
	return Vector3I(pbc[0] ? (int)floor(rp.X) : 0, pbc[1] ? (int)floor(rp.Y) : 0, pbc[2] ? (int)floor(rp.Z) : 0);
}

Point3 AnalysisEnvironment::wrapPoint(const Point3& p) const{
	Point3 result = p;
	// Transform point to reduced cell coordinates.
	Vector3 rp = reciprocalSimulationCell * (p - simulationCellOrigin);
	while(rp.X >= +1.0 && pbc[0]) { rp.X -= 1.0; result -= simulationCell.column(0); }
	while(rp.X <  0.0 && pbc[0]) { rp.X += 1.0; result += simulationCell.column(0); }
	while(rp.Y >= +1.0 && pbc[1]) { rp.Y -= 1.0; result -= simulationCell.column(1); }
	while(rp.Y <  0.0 && pbc[1]) { rp.Y += 1.0; result += simulationCell.column(1); }
	while(rp.Z >= +1.0 && pbc[2]) { rp.Z -= 1.0; result -= simulationCell.column(2); }
	while(rp.Z <  0.0 && pbc[2]) { rp.Z += 1.0; result += simulationCell.column(2); }
	return result;
}

Point3 AnalysisEnvironment::wrapReducedPoint(Point3 p) const{
	while(p.X >= +1.0 && pbc[0]) { p.X -= 1.0; }
	while(p.X <  0.0 && pbc[0]) { p.X += 1.0; }
	while(p.Y >= +1.0 && pbc[1]) { p.Y -= 1.0; }
	while(p.Y <  0.0 && pbc[1]) { p.Y += 1.0; }
	while(p.Z >= +1.0 && pbc[2]) { p.Z -= 1.0; }
	while(p.Z <  0.0 && pbc[2]) { p.Z += 1.0; }
	return p;
}

bool AnalysisEnvironment::readSimulationCell(ParserStream& stream){
	if(stream.line().find("ITEM: TIMESTEP") != string::npos) {
		if(sscanf(stream.readline().c_str(), "%i", &timestep) != 1)
			raiseError("File parsing error. Invalid timestep number (line %d): %s", stream.lineNumber(), stream.line().c_str());
		return true;
	}
	else if(stream.line().find("ITEM: BOX BOUNDS xy xz yz") == 0) {
		// Parse optional boundary condition flags.
		istringstream ss(stream.line().substr(strlen("ITEM: BOX BOUNDS xy xz yz")));
		string pbcx, pbcy, pbcz;
		ss >> pbcx >> pbcy >> pbcz;
		if(pbcx.length() == 2 && pbcy.length() == 2 && pbcz.length() == 2) {
			pbc[0] = (pbcx == "pp");
			pbc[1] = (pbcy == "pp");
			pbc[2] = (pbcz == "pp");
			MsgLogger() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2] << endl;
		}

		FloatType tiltFactors[3];
		FloatType simBox[2][3];
		for(size_t k=0; k<3; k++) {
			if(sscanf(stream.readline().c_str(), FLOAT_SCANF_STRING_3, &simBox[0][k], &simBox[1][k], &tiltFactors[k]) != 3)
				raiseError("File parsing error. Invalid box size in line %d of dump file: %s", stream.lineNumber(), stream.line().c_str());
		}

		simBox[0][0] -= min(min(min(tiltFactors[0], tiltFactors[1]), tiltFactors[0]+tiltFactors[1]), (FloatType)0.0);
		simBox[1][0] -= max(max(max(tiltFactors[0], tiltFactors[1]), tiltFactors[0]+tiltFactors[1]), (FloatType)0.0);
		simBox[0][1] -= min(tiltFactors[2], (FloatType)0.0);
		simBox[1][1] -= max(tiltFactors[2], (FloatType)0.0);
		simulationCellOrigin.X = simBox[0][0];
		simulationCellOrigin.Y = simBox[0][1];
		simulationCellOrigin.Z = simBox[0][2];
		simulationCell.column(0) = Vector3(simBox[1][0] - simBox[0][0], 0, 0);
		simulationCell.column(1) = Vector3(tiltFactors[0], simBox[1][1] - simBox[0][1], 0);
		simulationCell.column(2) = Vector3(tiltFactors[1], tiltFactors[2], simBox[1][2] - simBox[0][2]);
		MsgLogger() << "Triclinic simulation cell:" << endl;
		MsgLogger() << "   Origin: " << simulationCellOrigin << endl;
		MsgLogger() << "   Cell vector 1: " << simulationCell.column(0) << endl;
		MsgLogger() << "   Cell vector 2: " << simulationCell.column(1) << endl;
		MsgLogger() << "   Cell vector 3: " << simulationCell.column(2) << endl;
		return true;
	}else if(stream.line().find("ITEM: BOX BOUNDS") == 0) {
		// Parse optional boundary condition flags.
		istringstream ss(stream.line().substr(strlen("ITEM: BOX BOUNDS")));
		string pbcx, pbcy, pbcz;
		ss >> pbcx >> pbcy >> pbcz;
		if(pbcx.length() == 2 && pbcy.length() == 2 && pbcz.length() == 2) {
			pbc[0] = (pbcx == "pp");
			pbc[1] = (pbcy == "pp");
			pbc[2] = (pbcz == "pp");
			MsgLogger() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2] << endl;
		}

		FloatType simBox[2][3];
		MsgLogger() << "Orthogonal simulation cell:" << endl;
		for(size_t k=0; k<3; k++) {
			if(sscanf(stream.readline().c_str(), FLOAT_SCANF_STRING_2, &simBox[0][k], &simBox[1][k]) != 2)
				raiseError("File parsing error. Invalid box size in line %d of dump file: %s", stream.lineNumber(), stream.line().c_str());
			MsgLogger() << "   " << simBox[0][k] << "  " << simBox[1][k] << endl;
		}
		simulationCellOrigin.X = simBox[0][0];
		simulationCellOrigin.Y = simBox[0][1];
		simulationCellOrigin.Z = simBox[0][2];
		simulationCell.column(0) = Vector3(simBox[1][0] - simBox[0][0], 0, 0);
		simulationCell.column(1) = Vector3(0, simBox[1][1] - simBox[0][1], 0);
		simulationCell.column(2) = Vector3(0, 0, simBox[1][2] - simBox[0][2]);
		return true;
	}
	else if(stream.line().find("ITEM: PERIODIC BOUNDARY CONDITIONS") != string::npos) {
		int pbcFlags[3];
		if(sscanf(stream.readline().c_str(), "%u %u %u", &pbcFlags[0], &pbcFlags[1], &pbcFlags[2]) != 3)
			raiseError("File parsing error. Invalid periodic boundary condition flags in line %d of dump file: %s", stream.lineNumber(), stream.line().c_str());
		pbc[0] = (bool)pbcFlags[0];
		pbc[1] = (bool)pbcFlags[1];
		pbc[2] = (bool)pbcFlags[2];
		MsgLogger() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2] << endl;
		return true;
	}
	return false;
}

void AnalysisEnvironment::writeSimulationCellHeaderLAMMPS(ostream& stream){
	stream << "ITEM: TIMESTEP" << endl;
	stream << timestep << endl;
	if(simulationCell(0,1) == 0.0 && simulationCell(0,2) == 0.0 && simulationCell(1,2) == 0.0) {
		stream << "ITEM: BOX BOUNDS";
		if(pbc[0]) stream << " pp"; else stream << " ff";
		if(pbc[1]) stream << " pp"; else stream << " ff";
		if(pbc[2]) stream << " pp"; else stream << " ff";
		stream << endl;
		stream << simulationCellOrigin.X << " " << (simulationCellOrigin.X + simulationCell(0,0)) << endl;
		stream << simulationCellOrigin.Y << " " << (simulationCellOrigin.Y + simulationCell(1,1)) << endl;
		stream << simulationCellOrigin.Z << " " << (simulationCellOrigin.Z + simulationCell(2,2)) << endl;
	}else{
		stream << "ITEM: BOX BOUNDS xy xz yz";
		if(pbc[0]) stream << " pp"; else stream << " ff";
		if(pbc[1]) stream << " pp"; else stream << " ff";
		if(pbc[2]) stream << " pp"; else stream << " ff";
		stream << endl;
		FloatType xlo = simulationCellOrigin.X;
		FloatType ylo = simulationCellOrigin.Y;
		FloatType zlo = simulationCellOrigin.Z;
		FloatType xhi = simulationCell.column(0).X + xlo;
		FloatType yhi = simulationCell.column(1).Y + ylo;
		FloatType zhi = simulationCell.column(2).Z + zlo;
		FloatType xy = simulationCell.column(1).X;
		FloatType xz = simulationCell.column(2).X;
		FloatType yz = simulationCell.column(2).Y;
		xlo = min(xlo, xlo+xy);
		xlo = min(xlo, xlo+xz);
		ylo = min(ylo, ylo+yz);
		xhi = max(xhi, xhi+xy);
		xhi = max(xhi, xhi+xz);
		yhi = max(yhi, yhi+yz);
		stream << xlo << " " << xhi << " " << xy << endl;
		stream << ylo << " " << yhi << " " << xz << endl;
		stream << zlo << " " << zhi << " " << yz << endl;
	}
}

void AnalysisEnvironment::setupSimulationCell(FloatType cutoffRadius){
	reciprocalSimulationCell = simulationCell.inverse();
	DISLOCATIONS_ASSERT(cutoffRadius > 0.0);

	Matrix3 m = Matrix3(cutoffRadius,0,0, 0,cutoffRadius,0, 0,0,cutoffRadius) * reciprocalSimulationCell;
	for(size_t i = 0; i < 3; i++) {
		int binDim = (int)(Length(simulationCell.column(i)) / cutoffRadius);
		binDim = min(binDim, (int)(1.0 / Length(m.column(i))));
		if(binDim < 1 && pbc[i])
			raiseError("Periodic simulation cell is smaller than the neighbor cutoff radius. Minimum image convention cannot be used with such a small simulation box.");

		Vector3 normal = Normalize(CrossProduct(simulationCell.column((i+1)%3), simulationCell.column((i+2)%3)));
		if(DotProduct(normal, simulationCell.column(i)) <= cutoffRadius * 2)
			raiseError("Simulation cell is too narrow. Cell size must be at least twice the cutoff radius.");
	}
}

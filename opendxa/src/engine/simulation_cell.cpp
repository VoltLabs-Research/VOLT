#include <opendxa/engine/analysis_environment.hpp>
#include <algorithm>
#include <cmath>

Vector3 AnalysisEnvironment::wrapVector(const Vector3& v) const{
	Vector3 result = v;
	Vector3 rv = reciprocalSimulationCell * v;
	
	// X component
	if(pbc[0]){
		if(rv.X > 0.5f){
			int shifts = static_cast<int>(std::floor(rv.X + 0.5f));
			rv.X -= shifts;
			result -= simulationCell.column(0) * shifts;
		}else if(rv.X < -0.5f){
			int shifts = static_cast<int>(std::floor(-rv.X + 0.5f));
			rv.X += shifts;
			result += simulationCell.column(0) * shifts;
		}
	}
	
	// Y component  
	if(pbc[1]){
		if(rv.Y > 0.5f){
			int shifts = static_cast<int>(std::floor(rv.Y + 0.5f));
			rv.Y -= shifts;
			result -= simulationCell.column(1) * shifts;
		}else if(rv.Y < -0.5f){
			int shifts = static_cast<int>(std::floor(-rv.Y + 0.5f));
			rv.Y += shifts;
			result += simulationCell.column(1) * shifts;
		}
	}
	
	// Z component
	if(pbc[2]){
		if(rv.Z > 0.5f){
			int shifts = static_cast<int>(std::floor(rv.Z + 0.5f));
			rv.Z -= shifts;
			result -= simulationCell.column(2) * shifts;
		}else if(rv.Z < -0.5f){
			int shifts = static_cast<int>(std::floor(-rv.Z + 0.5f));
			rv.Z += shifts;
			result += simulationCell.column(2) * shifts;
		}
	}
	
	return result;
}

Vector3 AnalysisEnvironment::wrapReducedVector(Vector3 rv) const{
	// X component
	if(pbc[0]){
		if(rv.X > 0.5f){
			rv.X -= static_cast<float>(static_cast<int>(std::floor(rv.X + 0.5f)));
		}else if(rv.X < -0.5f){
			rv.X += static_cast<float>(static_cast<int>(std::floor(-rv.X + 0.5f)));
		}
	}
	
	// Y component
	if(pbc[1]){
		if(rv.Y > 0.5f){
			rv.Y -= static_cast<float>(static_cast<int>(std::floor(rv.Y + 0.5f)));
		}else if(rv.Y < -0.5f){
			rv.Y += static_cast<float>(static_cast<int>(std::floor(-rv.Y + 0.5f)));
		}
	}
	
	// Z component
	if(pbc[2]){
		if(rv.Z > 0.5f){
			rv.Z -= static_cast<float>(static_cast<int>(std::floor(rv.Z + 0.5f)));
		}else if(rv.Z < -0.5f){
			rv.Z += static_cast<float>(static_cast<int>(std::floor(-rv.Z + 0.5f)));
		}
	}
	
	return rv;
}

bool AnalysisEnvironment::isWrappedVector(const Vector3& v) const{
	Vector3 rv = reciprocalSimulationCell * v;
	return(pbc[0] && std::abs(rv.X) > 0.5f) ||
	      (pbc[1] && std::abs(rv.Y) > 0.5f) ||
	      (pbc[2] && std::abs(rv.Z) > 0.5f);
}

bool AnalysisEnvironment::isReducedWrappedVector(const Vector3& v) const{
	return(pbc[0] && std::abs(v.X) > 0.5f) ||
	      (pbc[1] && std::abs(v.Y) > 0.5f) ||
	      (pbc[2] && std::abs(v.Z) > 0.5f);
}

Vector3I AnalysisEnvironment::periodicImage(const Point3& p) const{
	Vector3 rp = reciprocalSimulationCell *(p - simulationCellOrigin);
	return Vector3I(
		pbc[0] ? static_cast<int>(std::floor(rp.X)) : 0,
		pbc[1] ? static_cast<int>(std::floor(rp.Y)) : 0,
		pbc[2] ? static_cast<int>(std::floor(rp.Z)) : 0
	);
}

Point3 AnalysisEnvironment::wrapPoint(const Point3& p) const{
	Point3 result = p;
	Vector3 rp = reciprocalSimulationCell *(p - simulationCellOrigin);
	
	// X component
	if(pbc[0]){
		if(rp.X >= 1.0f){
			int shifts = static_cast<int>(std::floor(rp.X));
			rp.X -= shifts;
			result -= simulationCell.column(0) * shifts;
		}else if(rp.X < 0.0f){
			int shifts = static_cast<int>(std::floor(-rp.X)) + 1;
			rp.X += shifts;
			result += simulationCell.column(0) * shifts;
		}
	}
	
	// Y component
	if(pbc[1]){
		if(rp.Y >= 1.0f){
			int shifts = static_cast<int>(std::floor(rp.Y));
			rp.Y -= shifts;
			result -= simulationCell.column(1) * shifts;
		}else if(rp.Y < 0.0f){
			int shifts = static_cast<int>(std::floor(-rp.Y)) + 1;
			rp.Y += shifts;
			result += simulationCell.column(1) * shifts;
		}
	}
	
	// Z component
	if(pbc[2]){
		if(rp.Z >= 1.0f){
			int shifts = static_cast<int>(std::floor(rp.Z));
			rp.Z -= shifts;
			result -= simulationCell.column(2) * shifts;
		}else if(rp.Z < 0.0f){
			int shifts = static_cast<int>(std::floor(-rp.Z)) + 1;
			rp.Z += shifts;
			result += simulationCell.column(2) * shifts;
		}
	}
	
	return result;
}

Point3 AnalysisEnvironment::wrapReducedPoint(Point3 p) const{
	// X component
	if(pbc[0]){
		if(p.X >= 1.0f){
			p.X -= static_cast<float>(static_cast<int>(std::floor(p.X)));
		}else if(p.X < 0.0f){
			p.X += static_cast<float>(static_cast<int>(std::floor(-p.X)) + 1);
		}
	}
	
	// Y component
	if(pbc[1]){
		if(p.Y >= 1.0f){
			p.Y -= static_cast<float>(static_cast<int>(std::floor(p.Y)));
		}else if(p.Y < 0.0f){
			p.Y += static_cast<float>(static_cast<int>(std::floor(-p.Y)) + 1);
		}
	}
	
	// Z component
	if(pbc[2]){
		if(p.Z >= 1.0f){
			p.Z -= static_cast<float>(static_cast<int>(std::floor(p.Z)));
		}else if(p.Z < 0.0f){
			p.Z += static_cast<float>(static_cast<int>(std::floor(-p.Z)) + 1);
		}
	}
	
	return p;
}

bool AnalysisEnvironment::readSimulationCell(ParserStream& stream){
	if(stream.line().find("ITEM: TIMESTEP") != std::string::npos){
		if(sscanf(stream.readline().c_str(), "%i", &timestep) != 1){
			raiseError("File parsing error. Invalid timestep number(line %d): %s", 
			          stream.lineNumber(), stream.line().c_str());
		}
		return true;
	}
	else if(stream.line().find("ITEM: BOX BOUNDS xy xz yz") == 0){
		std::istringstream ss(stream.line().substr(strlen("ITEM: BOX BOUNDS xy xz yz")));
		std::string pbcx, pbcy, pbcz;
		ss >> pbcx >> pbcy >> pbcz;
		if(pbcx.length() == 2 && pbcy.length() == 2 && pbcz.length() == 2){
			pbc[0] =(pbcx == "pp");
			pbc[1] =(pbcy == "pp");
			pbc[2] =(pbcz == "pp");
			LOG_INFO() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2];
		}

		FloatType tiltFactors[3];
		FloatType simBox[2][3];
		for(size_t k = 0; k < 3; k++){
			if(sscanf(stream.readline().c_str(), FLOAT_SCANF_STRING_3, 
			          &simBox[0][k], &simBox[1][k], &tiltFactors[k]) != 3){
				raiseError("File parsing error. Invalid box size in line %d of dump file: %s", 
				          stream.lineNumber(), stream.line().c_str());
			}
		}

		simBox[0][0] -= std::min({tiltFactors[0], tiltFactors[1], 
		                         tiltFactors[0] + tiltFactors[1], static_cast<FloatType>(0.0)});
		simBox[1][0] -= std::max({tiltFactors[0], tiltFactors[1], 
		                         tiltFactors[0] + tiltFactors[1], static_cast<FloatType>(0.0)});
		simBox[0][1] -= std::min(tiltFactors[2], static_cast<FloatType>(0.0));
		simBox[1][1] -= std::max(tiltFactors[2], static_cast<FloatType>(0.0));
		
		simulationCellOrigin.X = simBox[0][0];
		simulationCellOrigin.Y = simBox[0][1];
		simulationCellOrigin.Z = simBox[0][2];
		simulationCell.column(0) = Vector3(simBox[1][0] - simBox[0][0], 0, 0);
		simulationCell.column(1) = Vector3(tiltFactors[0], simBox[1][1] - simBox[0][1], 0);
		simulationCell.column(2) = Vector3(tiltFactors[1], tiltFactors[2], simBox[1][2] - simBox[0][2]);
		
		LOG_INFO() << "Triclinic simulation cell:";
		LOG_INFO() << "   Origin: " << simulationCellOrigin;
		LOG_INFO() << "   Cell vector 1: " << simulationCell.column(0);
		LOG_INFO() << "   Cell vector 2: " << simulationCell.column(1);
		LOG_INFO() << "   Cell vector 3: " << simulationCell.column(2);
		return true;
	}
	else if(stream.line().find("ITEM: BOX BOUNDS") == 0){
		// Parse optional boundary condition flags.
		std::istringstream ss(stream.line().substr(strlen("ITEM: BOX BOUNDS")));
		std::string pbcx, pbcy, pbcz;
		ss >> pbcx >> pbcy >> pbcz;
		if(pbcx.length() == 2 && pbcy.length() == 2 && pbcz.length() == 2){
			pbc[0] =(pbcx == "pp");
			pbc[1] =(pbcy == "pp");
			pbc[2] =(pbcz == "pp");
			LOG_INFO() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2];
		}

		FloatType simBox[2][3];
		LOG_INFO() << "Orthogonal simulation cell:";
		for(size_t k = 0; k < 3; k++){
			if(sscanf(stream.readline().c_str(), FLOAT_SCANF_STRING_2, 
			          &simBox[0][k], &simBox[1][k]) != 2){
				raiseError("File parsing error. Invalid box size in line %d of dump file: %s", 
				          stream.lineNumber(), stream.line().c_str());
			}
			LOG_INFO() << "   " << simBox[0][k] << "  " << simBox[1][k];
		}
		simulationCellOrigin.X = simBox[0][0];
		simulationCellOrigin.Y = simBox[0][1];
		simulationCellOrigin.Z = simBox[0][2];
		simulationCell.column(0) = Vector3(simBox[1][0] - simBox[0][0], 0, 0);
		simulationCell.column(1) = Vector3(0, simBox[1][1] - simBox[0][1], 0);
		simulationCell.column(2) = Vector3(0, 0, simBox[1][2] - simBox[0][2]);
		return true;
	}
	else if(stream.line().find("ITEM: PERIODIC BOUNDARY CONDITIONS") != std::string::npos){
		int pbcFlags[3];
		if(sscanf(stream.readline().c_str(), "%u %u %u", 
		          &pbcFlags[0], &pbcFlags[1], &pbcFlags[2]) != 3){
			raiseError("File parsing error. Invalid periodic boundary condition flags in line %d of dump file: %s", 
			          stream.lineNumber(), stream.line().c_str());
		}
		pbc[0] = static_cast<bool>(pbcFlags[0]);
		pbc[1] = static_cast<bool>(pbcFlags[1]);
		pbc[2] = static_cast<bool>(pbcFlags[2]);
		LOG_INFO() << "Periodic boundary conditions: " << pbc[0] << " " << pbc[1] << " " << pbc[2];
		return true;
	}
	return false;
}

void AnalysisEnvironment::writeSimulationCellHeaderLAMMPS(std::ostream& stream){
	stream << "ITEM: TIMESTEP\n";
	stream << timestep << "\n";
	
	if(simulationCell(0,1) == 0.0f && simulationCell(0,2) == 0.0f && simulationCell(1,2) == 0.0f){
		stream << "ITEM: BOX BOUNDS";
		if(pbc[0]) stream << " pp"; else stream << " ff";
		if(pbc[1]) stream << " pp"; else stream << " ff";
		if(pbc[2]) stream << " pp"; else stream << " ff";
		stream << "\n";
		stream << simulationCellOrigin.X << " " <<(simulationCellOrigin.X + simulationCell(0,0)) << "\n";
		stream << simulationCellOrigin.Y << " " <<(simulationCellOrigin.Y + simulationCell(1,1)) << "\n";
		stream << simulationCellOrigin.Z << " " <<(simulationCellOrigin.Z + simulationCell(2,2)) << "\n";
	}else{
		stream << "ITEM: BOX BOUNDS xy xz yz";
		if(pbc[0]) stream << " pp"; else stream << " ff";
		if(pbc[1]) stream << " pp"; else stream << " ff";
		if(pbc[2]) stream << " pp"; else stream << " ff";
		stream << "\n";
		
		FloatType xlo = simulationCellOrigin.X;
		FloatType ylo = simulationCellOrigin.Y;
		FloatType zlo = simulationCellOrigin.Z;
		FloatType xhi = simulationCell.column(0).X + xlo;
		FloatType yhi = simulationCell.column(1).Y + ylo;
		FloatType zhi = simulationCell.column(2).Z + zlo;
		FloatType xy = simulationCell.column(1).X;
		FloatType xz = simulationCell.column(2).X;
		FloatType yz = simulationCell.column(2).Y;
		
		xlo = std::min({xlo, xlo + xy, xlo + xz, xlo + xy + xz});
		xhi = std::max({xhi, xhi + xy, xhi + xz, xhi + xy + xz});
		ylo = std::min(ylo, ylo + yz);
		yhi = std::max(yhi, yhi + yz);
		
		stream << xlo << " " << xhi << " " << xy << "\n";
		stream << ylo << " " << yhi << " " << xz << "\n";
		stream << zlo << " " << zhi << " " << yz << "\n";
	}
}

void AnalysisEnvironment::setupSimulationCell(FloatType cutoffRadius){
	reciprocalSimulationCell = simulationCell.inverse();
	DISLOCATIONS_ASSERT(cutoffRadius > 0.0);

	Matrix3 m = Matrix3(cutoffRadius, 0, 0, 0, cutoffRadius, 0, 0, 0, cutoffRadius) * reciprocalSimulationCell;
	for(size_t i = 0; i < 3; i++){
		int binDim = static_cast<int>(Length(simulationCell.column(i)) / cutoffRadius);
		binDim = std::min(binDim, static_cast<int>(1.0 / Length(m.column(i))));
		if(binDim < 1 && pbc[i]){
			raiseError("Periodic simulation cell is smaller than the neighbor cutoff radius. "
			          "Minimum image convention cannot be used with such a small simulation box.");
		}

		Vector3 normal = Normalize(CrossProduct(simulationCell.column((i+1)%3), simulationCell.column((i+2)%3)));
		if(DotProduct(normal, simulationCell.column(i)) <= cutoffRadius * 2){
			raiseError("Simulation cell is too narrow. Cell size must be at least twice the cutoff radius.");
		}
	}
}
#ifndef __DXA_BASE_H
#define __DXA_BASE_H

#include <opendxa/Includes.hpp>
#include <opendxa/Settings.hpp>
#include <opendxa/parser/ParserStream.hpp>

class AnalysisEnvironment{
public:
	AnalysisEnvironment();
	static void raiseError(const char* format, ...);

	void setPBC(bool pbcX, bool pbcY, bool pbcZ) { pbc[0] = pbcX; pbc[1] = pbcY; pbc[2] = pbcZ; }
	const bool* pbcFlags() const { return pbc; }
	bool hasPeriodicBoundaries() const { return pbc[0] || pbc[1] || pbc[2]; }

	Vector3 wrapVector(const Vector3& v) const;
	Vector3 wrapReducedVector(Vector3 rv) const;

	bool isWrappedVector(const Vector3& v) const;
	bool isReducedWrappedVector(const Vector3& v) const;

	Vector3I periodicImage(const Point3& p) const;

	Point3 wrapPoint(const Point3& p) const;
	Point3 wrapReducedPoint(Point3 p) const;
	Point3 reducedToAbsolute(const Point3& reducedPoint) const { return getSimulationCellOrigin() + (getSimulationCell() * (reducedPoint - ORIGIN)); }
	Point3 absoluteToReduced(const Point3& worldPoint) const { return ORIGIN + (getReciprocalSimulationCell() * (worldPoint - getSimulationCellOrigin())); }

	Vector3 reducedToAbsolute(const Vector3& reducedVec) const { return getSimulationCell() * reducedVec; }
	Vector3 absoluteToReduced(const Vector3& worldVec) const { return getReciprocalSimulationCell() * worldVec; }

	const Matrix3& getSimulationCell() const { return simulationCell; }
	const Point3& getSimulationCellOrigin() const { return simulationCellOrigin; }
	const Matrix3& getReciprocalSimulationCell() const { return reciprocalSimulationCell; }

	void writeSimulationCellFileVTK(ostream& stream) const;
	void writeSimulationCellHeaderLAMMPS(ostream& stream);

protected:
	bool readSimulationCell(ParserStream& stream);
	void setupSimulationCell(FloatType cutoffRadius);

protected:
	int timestep;
	int processor;
	bool pbc[3];
	Matrix3 simulationCell;
	Point3 simulationCellOrigin;
	Matrix3 reciprocalSimulationCell;

	template<typename Particle>
	friend class NeighborListBuilder;
};

#endif
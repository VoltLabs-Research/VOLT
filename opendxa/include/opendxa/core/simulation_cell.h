#pragma once

#include <opendxa/core/opendxa.h>

namespace OpenDXA::Particles{

class SimulationCell{
public:
	SimulationCell(){
		_simulationCell = AffineTransformation::Zero();
		_reciprocalSimulationCell = AffineTransformation::Zero();
		_pbcFlags.fill(true);
		_is2D = false;
	}

	[[nodiscard]] bool hasPbc(size_t dim) const noexcept {
        assert(dim < 3);
        return _pbcFlags[dim];
    }

	[[nodiscard]] constexpr bool is2D() const noexcept{
		return _is2D;
	}

	void set2D(bool is2D){
		_is2D = is2D;
		if(is2D){
			_pbcFlags[2] = false;
		}
		computeInverseMatrix();
	}

	[[nodiscard]] const AffineTransformation& matrix() const noexcept{
		return _simulationCell;
	}

	[[nodiscard]] const AffineTransformation& inverseMatrix() const noexcept{
		return _reciprocalSimulationCell;
	}

	void setMatrix(const AffineTransformation &cellMatrix){
		_simulationCell = cellMatrix;
		computeInverseMatrix();
	}

	[[nodiscard]] const std::array<bool, 3>& pbcFlags() const noexcept{
		return _pbcFlags;
	}

	void setPbcFlags(const std::array<bool, 3>& flags){
		_pbcFlags = flags;
	}

	void setPbcFlags(bool pbcX, bool pbcY, bool pbcZ){
		_pbcFlags = { pbcX, pbcY, pbcZ };
	}

	[[nodiscard]] double volume3D() const{
		return std::abs(_simulationCell.determinant());
	}

	[[nodiscard]] double volume2D() const{
		return _simulationCell.column(0).cross(_simulationCell.column(1)).length();
	}

	[[nodiscard]] bool isAxisAligned() const{
		const auto& m = matrix();
		return m(1,0)==0 && m(2,0)==0 &&
		       m(0,1)==0 && m(2,1)==0 &&
		       m(0,2)==0 && m(1,2)==0;
	}

	[[nodiscard]] bool operator==(const SimulationCell& other) const = default;

	[[nodiscard]] Point3 reducedToAbsolute(const Point3& reducedPoint) const{
		return _simulationCell * reducedPoint;
	}

	[[nodiscard]] Point3 absoluteToReduced(const Point3& absPoint) const{
		return _reciprocalSimulationCell * absPoint;
	}

	[[nodiscard]] Vector3 reducedToAbsolute(const Vector3& reducedVec) const{
		return _simulationCell * reducedVec;
	}
	
	[[nodiscard]] Vector3 absoluteToReduced(const Vector3& absVec) const{
		return _reciprocalSimulationCell * absVec;
	}

	[[nodiscard]] Point3 wrapPoint(const Point3& p) const{
		Point3 pout = p;
		for(size_t dim = 0; dim < 3; ++dim){
			if(_pbcFlags[dim]){
				if(double s = std::floor(_reciprocalSimulationCell.prodrow(p, dim))){
					pout -= s * _simulationCell.column(dim);
				}
			}
		}
		return pout;
	}

	[[nodiscard]] Vector3 wrapVector(const Vector3& v) const{
		Vector3 vout = v;
		for(size_t dim = 0; dim < 3; ++dim){
			if(_pbcFlags[dim]){
				if(double s = std::floor(_reciprocalSimulationCell.prodrow(v, dim) + double(0.5))){
					vout -= s * _simulationCell.column(dim);
				}
			}
		}
		return vout;
	}

	[[nodiscard]] Vector3 cellNormalVector(size_t dim) const{
		Vector3 normal = _simulationCell.column((dim + 1) % 3).cross(_simulationCell.column((dim + 2) % 3));
		return (normal.dot(_simulationCell.column(dim)) < 0.0f) ? (normal / -normal.length()) : normal.normalized();
	}

	[[nodiscard]] bool isWrappedVector(const Vector3& v) const{
		for(size_t dim = 0; dim < 3; ++dim){
			if(_pbcFlags[dim] && std::abs(_reciprocalSimulationCell.prodrow(v, dim)) >= 0.5f){
				return true;
			}
		}
		return false;
	}

	static constexpr int modulo(int k, int n){
		return ((k %= n) < 0) ? k + n : k;
	}

	static constexpr double modulo(double k, double n){
		k = std::fmod(k, n);
		return (k < 0) ? k + n : k;
	}

private:
	void computeInverseMatrix() {
		if(!_is2D){
			if(!_simulationCell.inverse(_reciprocalSimulationCell)){
				_reciprocalSimulationCell.setIdentity();
			}
		}else{
			_reciprocalSimulationCell.setIdentity();
			double det = _simulationCell(0,0)*_simulationCell(1,1) - _simulationCell(0,1)*_simulationCell(1,0);
			if(std::abs(det) > EPSILON){
				_reciprocalSimulationCell(0,0) = _simulationCell(1,1) / det;
				_reciprocalSimulationCell(1,0) = -_simulationCell(1,0) / det;
				_reciprocalSimulationCell(0,1) = -_simulationCell(0,1) / det;
				_reciprocalSimulationCell(1,1) = _simulationCell(0,0) / det;
			}
		}
	}

	AffineTransformation _simulationCell{};
	AffineTransformation _reciprocalSimulationCell{};
	std::array<bool, 3> _pbcFlags{};
	bool _is2D{};
};

}
#ifndef __DXA_NEIGHBOR_LIST_H
#define __DXA_NEIGHBOR_LIST_H

#include "../Includes.hpp"
#include "../utils/linalg/LinAlg.hpp"
#include "../engine/AnalysisEnvironment.hpp"

template<typename Particle>
class NeighborListBuilder{
public:
	void initialize(const AnalysisEnvironment& cell, FloatType cutoff){
		this->cutoff = cutoff;
		this->cutoffSquared = cutoff*cutoff;
		simulationCell = cell.simulationCell;
		reciprocalSimulationCell = cell.reciprocalSimulationCell;

		binOrigin = cell.simulationCellOrigin;
		Matrix3 binCell;
		Matrix3 m = (Matrix3(IDENTITY) * cutoff) * cell.reciprocalSimulationCell;
		for(size_t i=0; i<3; i++) {
			binDim[i] = (int)(Length(cell.simulationCell.column(i)) / cutoff);
			binDim[i] = min(binDim[i], (int)(1.0 / Length(m.column(i))));
			binDim[i] = min(binDim[i], 40);
			binDim[i] = max(binDim[i], 1);
			binCell.column(i) = cell.simulationCell.column(i) / (FloatType)binDim[i];
			pbc[i] = cell.pbc[i];
		}
		reciprocalBinCell = binCell.inverse();

		bins.clear();
		bins.resize(binDim[0] * binDim[1] * binDim[2]);
	}

	void insertParticle(Particle& particle){
		Vector3 rp = reciprocalBinCell * (particle.pos - binOrigin);
		int binCoord[3];
		for(size_t k = 0; k < 3; k++) {
			binCoord[k] = (int)floor(rp[k]);
			if(pbc[k]) {
				while(binCoord[k] < 0) binCoord[k] += binDim[k];
				while(binCoord[k] >= binDim[k]) binCoord[k] -= binDim[k];
			}
			else {
				binCoord[k] = max(min(binCoord[k], binDim[k]-1), 0);
			}
		}
		int binIndex = binCoord[2] * binDim[0] * binDim[1] + binCoord[1] * binDim[0] + binCoord[0];
		DISLOCATIONS_ASSERT(binIndex < bins.size() && binIndex >= 0);
		// Insert into linked list of bin.
		particle.nextInBin = bins[binIndex];
		bins[binIndex] = &particle;
	}

	bool areNeighbors(Particle* particle1, Particle* particle2) const{
		DISLOCATIONS_ASSERT(particle1 != particle2);
		for(iterator neighborIter(*this, particle1); !neighborIter.atEnd(); neighborIter.next())
			if(neighborIter.current() == particle2) return true;
		return false;
	}

	class iterator_base {
	public:
		iterator_base(const NeighborListBuilder& neighborList, Particle* particle, const Point3& center) : _list(neighborList), centerindex(particle){
			dir[0] = -2;
			dir[1] = 1;
			dir[2] = 1;
			binatom = NULL;
			if(particle)
				this->center = particle->pos;
			else
				this->center = center;
			neighborindex = NULL;
		}


		bool atEnd() const { return dir[0] > 1; }
		Particle* current() { return neighborindex; }
		const Vector3& delta() const { return _delta; }
		FloatType distanceSquared() const { return distsq; }

	protected:
		const NeighborListBuilder& _list;
		Point3 center;
		Particle* centerindex;
		int dir[3];
		int centerbin[3];
		int currentbin[3];
		Particle* binatom;
		Particle* neighborindex;
		Vector3 _delta;
		FloatType distsq;
	};


	class iterator : public iterator_base {
	public:
		iterator(const NeighborListBuilder& neighborList, Particle* particle, const Point3& center = ORIGIN) : iterator_base(neighborList, particle, center)
		{
			Vector3 reducedp = this->_list.reciprocalBinCell * (this->center - this->_list.binOrigin);
			for(size_t k=0; k<3; k++) {
				// Determine the atom's bin from its position.
				this->centerbin[k] = (int)floor(reducedp[k]);
				if(this->_list.pbc[k]) {
					while(this->centerbin[k] < 0) this->centerbin[k] += this->_list.binDim[k];
					while(this->centerbin[k] >= this->_list.binDim[k]) this->centerbin[k] -= this->_list.binDim[k];
				}
				else {
					this->centerbin[k] = max(min(this->centerbin[k], this->_list.binDim[k]-1), 0);
				}
				DISLOCATIONS_ASSERT(this->centerbin[k] >= 0 && this->centerbin[k] < this->_list.binDim[k]);
			}
			next();
		}

		Particle* next()
		{
			while(this->dir[0] != 2) {
				while(this->binatom) {
					this->neighborindex = this->binatom;
					this->binatom = this->binatom->nextInBin;
					this->_delta = this->_list.wrapVector(this->neighborindex->pos - this->center);
					this->distsq = LengthSquared(this->_delta);
					if(this->distsq <= this->_list.cutoffSquared && this->neighborindex != this->centerindex)
						return this->neighborindex;
				}
				if(this->dir[2] == 1) {
					this->dir[2] = -1;
					if(this->dir[1] == 1) {
						this->dir[1] = -1;
						if(this->dir[0] == 1) {
							this->dir[0]++;
							this->neighborindex = NULL;
							return NULL;
						}
						else this->dir[0]++;
					}
					else this->dir[1]++;
				}
				else this->dir[2]++;

				size_t k;
				for(k = 0; k < 3; k++) {
					this->currentbin[k] = this->centerbin[k] + this->dir[k];
					if(this->_list.pbc[k]) {
						if(this->currentbin[k] == -1) { this->currentbin[k] = this->_list.binDim[k]-1; }
						else if(this->currentbin[k] == this->_list.binDim[k]) { this->currentbin[k] = 0; }
					}
					else {
						if(this->currentbin[k] == -1) { break; }
						else if(this->currentbin[k] == this->_list.binDim[k]) { break; }
					}
				}
				if(k != 3)
					continue;

				int binIndex = this->currentbin[2] * this->_list.binDim[0] * this->_list.binDim[1] + this->currentbin[1] * this->_list.binDim[0] + this->currentbin[0];
				DISLOCATIONS_ASSERT(binIndex < this->_list.bins.size() && binIndex >= 0);
				this->binatom = this->_list.bins[binIndex];
			}
			this->neighborindex = NULL;
			return NULL;
		}
	};

	inline Vector3 wrapVector(const Vector3& v) const{
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

private:
	Matrix3 reciprocalBinCell;
	Matrix3 simulationCell;
	Matrix3 reciprocalSimulationCell;
	bool pbc[3];
	Point3 binOrigin;
	int binDim[3];
	vector<Particle*> bins;
	FloatType cutoff;
	FloatType cutoffSquared;
};

#endif


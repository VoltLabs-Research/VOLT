#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/core/particle_property.h>

#include <Delaunay_psm.h>
#include <vector>
#include <utility>

namespace OpenDXA{

class DelaunayTessellation{
public:
    using size_type = GEO::index_t;
    using CellHandle = GEO::index_t;
    using VertexHandle = GEO::index_t;
    using CellIterator = size_type;
    using Facet = std::pair<CellHandle, int>;

	struct CellInfo{
		bool isGhost;
		int userField = 0;
		int index = -1;
	};

	class FacetCirculator{
	public:
		FacetCirculator(const DelaunayTessellation& tess, CellHandle cell, int s, int t, CellHandle start, int f)
            : _tess(tess), _s(tess.cellVertex(cell, s)), _t(tess.cellVertex(cell, t)){
            const int i = tess._dt->index(start, _s);
            const int j = tess._dt->index(start, _t);

            assert(f != i && f != j);
			_pos = (f == next_around_edge(i, j)) ? start : tess._dt->cell_adjacent(start, f);
		}

		FacetCirculator& operator++(){
            _pos = _tess._dt->cell_adjacent(_pos, next_around_edge(_tess._dt->index(_pos, _s), _tess._dt->index(_pos, _t)));
            return *this;
		}

		FacetCirculator operator++(int){
            auto tmp = *this;
            ++(*this);
            return tmp;
        }

		FacetCirculator& operator--(){
            _pos = _tess._dt->cell_adjacent(_pos,
                next_around_edge(_tess._dt->index(_pos, _t), _tess._dt->index(_pos, _s)));
            return *this;
        }

        FacetCirculator operator--(int){
            auto tmp = *this;
            --(*this);
            return tmp;
        }

		[[nodiscard]] Facet operator*() const {
            return { _pos, next_around_edge(_tess._dt->index(_pos, _s), _tess._dt->index(_pos, _t)) };
        }

        [[nodiscard]] Facet operator->() const {
            return **this;
        }

		[[nodiscard]] bool operator==(const FacetCirculator& other) const {
			return _pos == other._pos && _s == other._s && _t == other._t;
		}

		[[nodiscard]] bool operator!=(const FacetCirculator& other) const {
			return !(*this == other);
		}

	private:
        const DelaunayTessellation& _tess;
        VertexHandle _s, _t;
        CellHandle _pos;

        static constexpr int next_around_edge(int i, int j) {
            constexpr int table[4][4] = {
                {5, 2, 3, 1},
                {3, 5, 0, 2},
                {1, 3, 5, 0},
                {2, 0, 1, 5}
            };
            return table[i][j];
        }
	};

	[[nodiscard]] bool generateTessellation(const SimulationCell& simCell, const Point3* positions,
		size_t numPoints, double ghostLayerSize, const int* selectedPoints = nullptr);
	
    [[nodiscard]] size_type numberOfTetrahedra() const{
		return _dt->nb_cells();
	}

    [[nodiscard]] size_type numberOfPrimaryTetrahedra() const{
		return _numPrimaryTetrahedra;
	}

    [[nodiscard]] CellIterator begin_cells() const{
		return 0;
	}

    [[nodiscard]] CellIterator end_cells() const{
		return _dt->nb_cells();
	}

    void setCellIndex(CellHandle cell, int value){
		_cellInfo[cell].index = value;
	}

    [[nodiscard]] int getCellIndex(CellHandle cell) const{
		return _cellInfo[cell].index;
	}

    void setUserField(CellHandle cell, int value){
		_cellInfo[cell].userField = value;
	}

    [[nodiscard]] int getUserField(CellHandle cell) const{
		return _cellInfo[cell].userField;
	}

    [[nodiscard]] bool isValidCell(CellHandle cell) const{
		return _dt->cell_is_finite(cell);
	}

    [[nodiscard]] bool isGhostCell(CellHandle cell) const{
		return _cellInfo[cell].isGhost;
	}

    [[nodiscard]] bool isGhostVertex(VertexHandle vertex) const{
		return vertex >= _primaryVertexCount;
	}

	[[nodiscard]] VertexHandle cellVertex(CellHandle cell, size_type localIndex) const{
        return _dt->cell_vertex(cell, localIndex);
    }

    [[nodiscard]] Point3 vertexPosition(VertexHandle vertex) const{
        const double* xyz = _dt->vertex_ptr(vertex);
        return { static_cast<double>(xyz[0]), static_cast<double>(xyz[1]), static_cast<double>(xyz[2]) };
    }

    [[nodiscard]] bool alphaTest(CellHandle cell, double alpha) const;

    [[nodiscard]] int vertexIndex(VertexHandle vertex) const{
        assert(vertex < _particleIndices.size());
        return _particleIndices[vertex];
    }

    [[nodiscard]] Facet mirrorFacet(CellHandle cell, int face) const{
        const auto adj = _dt->cell_adjacent(cell, face);
        assert(adj >= 0);
        return { static_cast<CellHandle>(adj), _dt->adjacent_index(adj, cell) };
    }

    [[nodiscard]] Facet mirrorFacet(const Facet& f) const{
        return mirrorFacet(f.first, f.second);
    }

    [[nodiscard]] static constexpr int cellFacetVertexIndex(int face, int corner){
        constexpr int table[4][3] = {
            {1, 3, 2},
            {0, 2, 3},
            {0, 3, 1},
            {0, 1, 2}
        };
        return table[face][corner];
    }

    [[nodiscard]] FacetCirculator incident_facets(CellHandle cell, int i, int j, CellHandle start, int f) const{
        return FacetCirculator(*this, cell, i, j, start, f);
    }

    [[nodiscard]] const SimulationCell& simCell() const{
		return _simCell;
	}
	
private:
    bool classifyGhostCell(CellHandle cell) const;

    GEO::Delaunay_var _dt;
    std::vector<double> _pointData;
    std::vector<CellInfo> _cellInfo;
    std::vector<int> _particleIndices;

    size_type _primaryVertexCount = 0;
    size_type _numPrimaryTetrahedra = 0;

    SimulationCell _simCell;
};

}
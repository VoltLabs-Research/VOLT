#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/core/simulation_cell.h>
#include <opendxa/core/particle_property.h>
#include <opendxa/geometry/delaunay_tessellation.h>

#include <boost/functional/hash.hpp>
#include <type_traits>
#include <unordered_map>
#include <array>
#include <vector>
#include <algorithm>

namespace OpenDXA{

template<class HalfEdgeStructureType, bool FlipOrientation = false, bool CreateTwoSidedMesh = false>
class ManifoldConstructionHelper{
public:
	struct DefaultPrepareMeshFaceFunc{
		void operator()(
			typename HalfEdgeStructureType::Face*, 
			const std::array<int, 3>&, 
			const std::array<DelaunayTessellation::VertexHandle, 3>&, 
			DelaunayTessellation::CellHandle
		){}
	};

	struct DefaultLinkManifoldsFunc{
		void operator()(
			typename HalfEdgeStructureType::Edge*, 
			typename HalfEdgeStructureType::Edge*
		){}
	};

	ManifoldConstructionHelper(DelaunayTessellation& tessellation, HalfEdgeStructureType& outputMesh, double alpha, ParticleProperty* positions)
		: _tessellation(tessellation), _mesh(outputMesh), _alpha(alpha), _positions(positions){}

	template<typename CellRegionFunc, typename PrepareMeshFaceFunc = DefaultPrepareMeshFaceFunc, typename LinkManifoldsFunc = DefaultLinkManifoldsFunc>
	bool construct(
		CellRegionFunc&& determineCellRegion,
		PrepareMeshFaceFunc&& prepareMeshFaceFunc = PrepareMeshFaceFunc(),
		LinkManifoldsFunc&& linkManifoldsFunc = LinkManifoldsFunc()
	){
		if(!classifyTetrahedra(std::move(determineCellRegion))) return false;
		if(!createInterfaceFacets(std::move(prepareMeshFaceFunc))) return false;
		if(!linkHalfedges(std::move(linkManifoldsFunc))) return false;
		return true;
	}

	int spaceFillingRegion() const{
		return _spaceFillingRegion;
	}

private:
	template<typename CellRegionFunc>
	bool classifyTetrahedra(CellRegionFunc&& determineCellRegion){
		_numSolidCells = 0;
		_spaceFillingRegion = -2;

		for(auto cell = _tessellation.begin_cells(); cell != _tessellation.end_cells(); ++cell){
			bool isSolid = _tessellation.isValidCell(cell) && _tessellation.alphaTest(cell, _alpha);
			if(!isSolid){
				_tessellation.setUserField(cell, 0);
			}else{
				_tessellation.setUserField(cell, determineCellRegion(cell));
			}

			if(!_tessellation.isGhostCell(cell)){
				if(_spaceFillingRegion == -2){
					_spaceFillingRegion = _tessellation.getUserField(cell);
				}else if(_spaceFillingRegion != _tessellation.getUserField(cell)){
					_spaceFillingRegion = -1;
				}
			}

			if(_tessellation.getUserField(cell) != 0 && !_tessellation.isGhostCell(cell)){
				_tessellation.setCellIndex(cell, _numSolidCells++);
			}else{
				_tessellation.setCellIndex(cell, -1);
			}
		}

		if(_spaceFillingRegion == -2) _spaceFillingRegion = 0;
		return true;
	}

	template<typename PrepareMeshFaceFunc>
	bool createInterfaceFacets(PrepareMeshFaceFunc&& prepareMeshFaceFunc){
		std::vector<typename HalfEdgeStructureType::Vertex*> vertexMap(_positions->size(), nullptr);
		_tetrahedraFaceList.clear();
		_faceLookupMap.clear();

		for(auto cell = _tessellation.begin_cells(); cell != _tessellation.end_cells(); ++cell){
			if(_tessellation.getCellIndex(cell) == -1) continue;
			int solidRegion = _tessellation.getUserField(cell);
			Point3 unwrappedVerts[4];
			for(int i = 0; i < 4; i++){
				unwrappedVerts[i] = _tessellation.vertexPosition(_tessellation.cellVertex(cell, i));
			}

			_tessellation.setCellIndex(cell, -1);
			for(int f = 0; f < 4; f++){
				auto mirrorFacet = _tessellation.mirrorFacet(cell, f);
				auto adjacentCell = mirrorFacet.first;
				if(_tessellation.getUserField(adjacentCell) == solidRegion) continue;

				std::array<typename HalfEdgeStructureType::Vertex*,3> facetVertices;
				std::array<DelaunayTessellation::VertexHandle,3> vertexHandles;
				std::array<int,3> vertexIndices;
				for(int v = 0; v < 3; v++){
					vertexHandles[v] = _tessellation.cellVertex(cell, DelaunayTessellation::cellFacetVertexIndex(f, FlipOrientation ? (2-v) : v));
					int idx = vertexIndices[v] = _tessellation.vertexIndex(vertexHandles[v]);
					if(vertexMap[idx] == nullptr){
						vertexMap[idx] = _mesh.createVertex(_positions->getPoint3(idx));
					}
					facetVertices[v] = vertexMap[idx];
				}

				auto* face = _mesh.createFace(facetVertices.begin(), facetVertices.end());
				if(!std::is_same_v<PrepareMeshFaceFunc, std::nullptr_t>){
					prepareMeshFaceFunc(face, vertexIndices, vertexHandles, cell);
				}

				if constexpr(CreateTwoSidedMesh){
					if(_tessellation.getUserField(adjacentCell) == 0){
						std::reverse(vertexHandles.begin(), vertexHandles.end());
						std::array<int,3> reverseVertexIndices;
						for(int v = 0; v < 3; v++){
							vertexHandles[v] = _tessellation.cellVertex(adjacentCell, DelaunayTessellation::cellFacetVertexIndex(mirrorFacet.second, FlipOrientation ? (2-v) : v));
							int idx = reverseVertexIndices[v] = _tessellation.vertexIndex(vertexHandles[v]);
							facetVertices[v] = vertexMap[idx];
						}

						auto* oppositeFace = _mesh.createFace(facetVertices.begin(), facetVertices.end());

						if(!std::is_same_v<PrepareMeshFaceFunc, std::nullptr_t>){
							prepareMeshFaceFunc(oppositeFace, reverseVertexIndices, vertexHandles, adjacentCell);
						}
						reorderFaceVertices(reverseVertexIndices);
						_faceLookupMap.emplace(reverseVertexIndices, oppositeFace);
					}
				}

				reorderFaceVertices(vertexIndices);
				_faceLookupMap.emplace(vertexIndices, face);

				if(_tessellation.getCellIndex(cell) == -1){
					_tessellation.setCellIndex(cell, _tetrahedraFaceList.size());
					_tetrahedraFaceList.push_back({ nullptr, nullptr, nullptr, nullptr });
				}

				_tetrahedraFaceList[_tessellation.getCellIndex(cell)][f] = face;
			}
		}

		return true;
	}

	typename HalfEdgeStructureType::Face* findAdjacentFace(DelaunayTessellation::CellHandle cell, int f, int e){
		int v1 = FlipOrientation ? DelaunayTessellation::cellFacetVertexIndex(f, 2-e) : DelaunayTessellation::cellFacetVertexIndex(f, (e+1)%3);
		int v2 = FlipOrientation ? DelaunayTessellation::cellFacetVertexIndex(f, (4-e)%3) : DelaunayTessellation::cellFacetVertexIndex(f, e);

		auto start = _tessellation.incident_facets(cell, v1, v2, cell, f);
		auto circ = start;
		--circ;

		int region = _tessellation.getUserField(cell);
		while(_tessellation.getUserField((*circ).first) == region){
			--circ;
		}

		auto mirror = _tessellation.mirrorFacet(*circ);
		return findCellFace(mirror);
	}

	template<typename LinkManifoldsFunc>
	bool linkHalfedges(LinkManifoldsFunc&& linkManifoldsFunc){
		auto tet = _tetrahedraFaceList.cbegin();
		for(auto cell = _tessellation.begin_cells(); cell != _tessellation.end_cells(); ++cell){
			if(_tessellation.getCellIndex(cell) == -1) continue;

			for(int f = 0; f < 4; f++){
				auto* facet = (*tet)[f];
				if(!facet) continue;

				auto* edge = facet->edges();
				for(int e = 0; e < 3; ++e, edge = edge->nextFaceEdge()){
					if(edge->oppositeEdge()) continue;
					auto* oppFace = findAdjacentFace(cell, f, e);
					auto* oppEdge = oppFace->findEdge(edge->vertex2(), edge->vertex1());
					edge->linkToOppositeEdge(oppEdge);
				}

				if constexpr(CreateTwoSidedMesh){
					auto oppFacet = _tessellation.mirrorFacet(cell, f);
					auto* outerFacet = findCellFace(oppFacet);

					auto* edge1 = facet->edges();
					for(int i = 0; i < 3; ++i, edge1 = edge1->nextFaceEdge()){
						for(auto* edge2 = outerFacet->edges(); ; edge2 = edge2->nextFaceEdge()) {
							if(edge2->vertex1() == edge1->vertex2()) {
								linkManifoldsFunc(edge1, edge2);
								break;
							}
						}
					}

					if(_tessellation.getUserField(oppFacet.first) == 0){
						auto* edge = outerFacet->edges();
						for(int e = 0; e < 3; ++e, edge = edge->nextFaceEdge()){
							if(edge->oppositeEdge()) continue;
							auto* oppFace = findAdjacentFace(oppFacet.first, oppFacet.second, e);
							auto* oppEdge = oppFace->findEdge(edge->vertex2(), edge->vertex1());
							edge->linkToOppositeEdge(oppEdge);
						}
					}
				}
			}
			++tet;
		}
		return true;
	}

	typename HalfEdgeStructureType::Face* findCellFace(const std::pair<DelaunayTessellation::CellHandle,int>& facet){
		auto cell = facet.first;
		if(_tessellation.getCellIndex(cell) != -1){
			return _tetrahedraFaceList[_tessellation.getCellIndex(cell)][facet.second];
		}
		std::array<int,3> faceVerts;
		for(std::size_t i = 0; i < 3; ++i){
			int idx = DelaunayTessellation::cellFacetVertexIndex(facet.second, FlipOrientation ? (2-i) : i);
			faceVerts[i] = _tessellation.vertexIndex(_tessellation.cellVertex(cell, idx));
		}
		reorderFaceVertices(faceVerts);
		auto it = _faceLookupMap.find(faceVerts);
		return (it != _faceLookupMap.end()) ? it->second : nullptr;
	}

	static void reorderFaceVertices(std::array<int,3>& vertexIndices){
		std::rotate(
			vertexIndices.begin(), 
			std::min_element(vertexIndices.begin(), vertexIndices.end()), 
			vertexIndices.end()
		);
	}

	DelaunayTessellation& _tessellation;
	double _alpha;
	int _numSolidCells = 0;
	int _spaceFillingRegion = -1;
	ParticleProperty* _positions;
	HalfEdgeStructureType& _mesh;
	std::vector<std::array<typename HalfEdgeStructureType::Face*, 4>> _tetrahedraFaceList;
	std::map<std::array<int,3>, typename HalfEdgeStructureType::Face*> _faceLookupMap;
};

}
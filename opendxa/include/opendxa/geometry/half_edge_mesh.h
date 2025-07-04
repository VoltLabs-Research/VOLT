#pragma once

#include <opendxa/core/opendxa.h>
#include <opendxa/utilities/memory_pool.h>
#include <opendxa/geometry/tri_mesh.h>

namespace OpenDXA{

struct EmptyHalfEdgeMeshStruct{};

template <
    class EdgeBase = EmptyHalfEdgeMeshStruct,
    class FaceBase = EmptyHalfEdgeMeshStruct,
    class VertexBase = EmptyHalfEdgeMeshStruct
>

class HalfEdgeMesh{
public:
    class Vertex;
    class Face;

    class Edge : public EdgeBase{
    public:
        [[nodiscard]] Vertex* vertex1() const noexcept{
			return _prevFaceEdge->_vertex2;
		}

        [[nodiscard]] Vertex* vertex2() const noexcept{
			return _vertex2;
		}

        [[nodiscard]] Face* face() const noexcept{
			return _face;
		}

        [[nodiscard]] Edge* nextVertexEdge() const noexcept{
			return _nextVertexEdge;
		}

        [[nodiscard]] Edge* nextFaceEdge() const noexcept{
			return _nextFaceEdge;
		}

        [[nodiscard]] Edge* prevFaceEdge() const noexcept{
			return _prevFaceEdge;
		}

        [[nodiscard]] Edge* oppositeEdge() const noexcept{
			return _oppositeEdge;
		}

        void linkToOppositeEdge(Edge* other) noexcept{
            assert(!_oppositeEdge && !other->_oppositeEdge);
            _oppositeEdge = other;
            other->_oppositeEdge = this;
        }

        Edge* unlinkFromOppositeEdge() noexcept{
            assert(_oppositeEdge && _oppositeEdge->_oppositeEdge == this);
            Edge* other = _oppositeEdge;
            _oppositeEdge = nullptr;
            other->_oppositeEdge = nullptr;
            return other;
        }

    protected:
        Edge(Vertex* v2, Face* f) noexcept
            : _oppositeEdge(nullptr)
            , _vertex2(v2)
            , _face(f)
            , _nextVertexEdge(nullptr)
            , _nextFaceEdge(nullptr)
            , _prevFaceEdge(nullptr){}

        Edge* _oppositeEdge;
        Vertex* _vertex2;
        Face* _face;
        Edge* _nextVertexEdge;
        Edge* _nextFaceEdge;
        Edge* _prevFaceEdge;

        friend class HalfEdgeMesh;
    };

    class Vertex : public VertexBase{
    public:
        [[nodiscard]] Edge* edges() const noexcept{
			return _edges;
		}

        [[nodiscard]] const Point3& pos() const noexcept{
			return _pos;
		}

        [[nodiscard]] Point3& pos() noexcept{
			return _pos;
		}

        void setPos(const Point3& p) noexcept{
			_pos = p; 
		}

        [[nodiscard]] int index() const noexcept{
			return _index;
		}

        [[nodiscard]] std::size_t numEdges() const noexcept{
			return _numEdges;
		}

        [[nodiscard]] int numManifolds() const{
            int count = 0;
            std::vector<Edge*> visited;
            for(Edge* start = edges(); start; start = start->nextVertexEdge()){
                if(std::find(visited.begin(), visited.end(), start) != visited.end()){
                    continue;
				}

                ++count;
                Edge* cur = start;
                do{
                    visited.push_back(cur);
                    cur = cur->prevFaceEdge()->oppositeEdge();
                }while(cur != start);
            }

            return count;
        }

        void transferEdgeToVertex(Edge* e, Vertex* v) noexcept{
            removeEdge(e);
            v->addEdge(e);
            e->oppositeEdge()->_vertex2 = v;
        }

    protected:
        Vertex(const Point3& p, int idx = -1) noexcept
            : _pos(p)
            , _edges(nullptr)
            , _numEdges(0)
            , _index(idx){}

        void addEdge(Edge* e) noexcept{
            e->_nextVertexEdge = _edges;
            _edges = e;
            ++_numEdges;
        }

        void removeEdge(Edge* e) noexcept{
            --_numEdges;
            if(e == _edges){
                _edges = e->nextVertexEdge();
                e->_nextVertexEdge = nullptr;
                return;
            }

            for(Edge* cur = _edges; cur; cur = cur->nextVertexEdge()){
                if(cur->nextVertexEdge() == e){
                    cur->_nextVertexEdge = e->_nextVertexEdge;
                    e->_nextVertexEdge = nullptr;
                    return;
                }
            }

            assert(false);
        }

        Point3 _pos;
        Edge* _edges;
        size_t _numEdges;
        int _index;

        friend class HalfEdgeMesh;
    };

    class Face : public FaceBase{
    public:
        [[nodiscard]] Edge* edges() const noexcept{
			return _edges;
		}

        [[nodiscard]] int index() const noexcept{
			return _index;
		}

        [[nodiscard]] unsigned int flags() const noexcept{
			return _flags;
		}

        [[nodiscard]] bool testFlag(unsigned int f) const noexcept{
			return _flags & f;
		}

        void setFlag(unsigned int f) noexcept{
			_flags |= f;
		}

        void clearFlag(unsigned int f) const noexcept{
			_flags &= ~f;
		}

        [[nodiscard]] std::size_t edgeCount() const{
            assert(edges());
            std::size_t cnt = 0;
            Edge* e = edges();
            do{
                ++cnt;
                e = e->nextFaceEdge();
            }while(e != edges());
            return cnt;
        }

        [[nodiscard]] Edge* findEdge(Vertex* v1, Vertex* v2) const noexcept{
            if(!edges()) return nullptr;

            Edge* e = edges();
            do{
                if(e->vertex1() == v1 && e->vertex2() == v2){
					return e;
				}
                e = e->nextFaceEdge();
            }while(e != edges());

            return nullptr;
        }

    protected:
        Face(int idx = -1) noexcept
            : _edges(nullptr)
            , _index(idx)
            , _flags(0){}

        Edge* _edges;
        int _index;
        mutable unsigned int _flags;

        friend class HalfEdgeMesh;
    };

public:
    HalfEdgeMesh() = default;
    HalfEdgeMesh(const HalfEdgeMesh& o){
		*this = o;
	}

    void clear() noexcept{
        _vertices.clear();
        _faces.clear();
        _vertexPool.clear();
        _edgePool.clear();
        _facePool.clear();
    }

    [[nodiscard]] const std::vector<Vertex*>& vertices() const noexcept{
		return _vertices;
	}

    [[nodiscard]] const std::vector<Face*>& faces() const noexcept{
		return _faces;
	}

    [[nodiscard]] std::size_t vertexCount() const noexcept{
		return _vertices.size();
	}

    [[nodiscard]] std::size_t faceCount() const noexcept{
		return _faces.size();
	}

    [[nodiscard]] Vertex* vertex(int idx) const noexcept{
        assert(idx >= 0 && idx < static_cast<int>(vertexCount()));
        return _vertices[idx];
    }

    [[nodiscard]] Face* face(int idx) const noexcept{
        assert(idx >= 0 && idx < static_cast<int>(faceCount()));
        return _faces[idx];
    }

    void reserveVertices(std::size_t n){
		_vertices.reserve(n);
	}

    void reserveFaces(std::size_t n){
		_faces.reserve(n);
	}

    Vertex* createVertex(const Point3& p){
        auto* v = _vertexPool.construct(p, static_cast<int>(vertexCount()));
        _vertices.push_back(v);
        return v;
    }

    template<typename It>
    Face* createFace(It b, It e){
        assert(std::distance(b, e) >= 2);
        Face* f = createFace();
        It v1 = b;
        for (It v2 = std::next(b); v2 != e; ++v1, ++v2){
            createEdge(*v1, *v2, f);
		}
        createEdge(*v1, *b, f);
        return f;
    }
	
    Face* createFace(std::initializer_list<Vertex*> v){
        return createFace(v.begin(), v.end());
    }

    void clearFaceFlag(unsigned int flag) const noexcept{
        for (Face* f : _faces){
            f->clearFlag(flag);
		}
    }

    bool connectOppositeHalfedges(){
        bool closed = true;
        for(Vertex* v1 : _vertices){
            for(Edge* e = v1->edges(); e; e = e->nextVertexEdge()){
                if(e->oppositeEdge()) continue;
                for(Edge* oe = e->vertex2()->edges(); oe; oe = oe->nextVertexEdge()){
                    if(!oe->oppositeEdge() && oe->vertex2() == v1){
                        e->linkToOppositeEdge(oe);
                        break;
                    }
                }
                if(!e->oppositeEdge()) closed = false;
            }
        }

        return closed;
    }

    template<class EB2, class FB2, class VB2>
    void copyFrom(const HalfEdgeMesh<EB2, FB2, VB2>& o){
        clear();
        reserveVertices(o.vertexCount());
        for(auto* v : o.vertices()){
            createVertex(v->pos());
		}

        reserveFaces(o.faceCount());
        for(auto* f : o.faces()){
            Face* fc = createFace();
            if(!f->edges()) continue;
            Edge* eo = f->edges();
            do{
                Vertex* v1 = vertex(eo->vertex1()->index());
                Vertex* v2 = vertex(eo->vertex2()->index());
                createEdge(v1, v2, fc);
                eo = eo->nextFaceEdge();
            }while (eo != f->edges());
        }

        linkCopiedOpposites(o);
    }

    HalfEdgeMesh& operator=(const HalfEdgeMesh& o){
        copyFrom(o);
        return *this;
    }

    void swap(HalfEdgeMesh& o) noexcept{
        _vertices.swap(o._vertices);
        _faces.swap(o._faces);
        _vertexPool.swap(o._vertexPool);
        _edgePool.swap(o._edgePool);
        _facePool.swap(o._facePool);
    }

    void convertToTriMesh(TriMesh& out) const{
        out.clear();
        out.setVertexCount(vertexCount());
        for(auto it = out.vertices().begin(); Vertex* v : _vertices){
            *it++ = v->pos();
		}

        std::size_t triCount = 0;
        for(Face* f : _faces){
            triCount += std::max<std::size_t>(f->edgeCount() - 2, 0);
		}

        out.setFaceCount(triCount);
        auto ft = out.faces().begin();
        for(Face* f : _faces){
            int base = f->edges()->vertex2()->index();
            Edge* e = f->edges()->nextFaceEdge()->nextFaceEdge();
            while(e != f->edges()){
                ft->setVertices(base, e->vertex1()->index(), e->vertex2()->index());
                ++ft;
                e = e->nextFaceEdge();
            }
        }

        out.invalidateVertices();
        out.invalidateFaces();
    }

    std::size_t duplicateSharedVertices(){
        std::size_t shared = 0;
        const std::size_t oldCount = _vertices.size();
        for(std::size_t i = 0; i < oldCount; ++i){
            Vertex* v = _vertices[i];
            if(v->numEdges() < 2) continue;
            std::vector<Edge*> visited;
            Edge* start = v->edges();
            do{
                visited.push_back(start);
                start = start->prevFaceEdge()->oppositeEdge();
            }while(start != v->edges());

            if(visited.size() == v->numEdges()) continue;

            while(visited.size() < v->numEdges()){
                Vertex* second = createVertex(v->pos());
                Edge* sel = nullptr;
                for(Edge* e = v->edges(); e; e = e->nextVertexEdge()){
                    if(std::find(visited.begin(), visited.end(), e) == visited.end()){
                        sel = e;
                        break;
                    }
                }
                Edge* cur = sel;
                do{
                    visited.push_back(cur);
                    v->transferEdgeToVertex(cur, second);
                    cur = cur->prevFaceEdge()->oppositeEdge();
                }while(cur != sel);
            }
            ++shared;
        }
        return shared;
    }

    [[nodiscard]] bool isClosed() const noexcept{
        for(Vertex* v : _vertices){
            for (Edge* e = v->edges(); e; e = e->nextVertexEdge()){
                if(!e->oppositeEdge()) return false;
			}
		}
        return true;
    }

    Face* createFace(){
        auto* f = _facePool.construct(static_cast<int>(faceCount()));
        _faces.push_back(f);
        return f;
    }

    Edge* createEdge(Vertex* v1, Vertex* v2, Face* f){
        auto* e = _edgePool.construct(v2, f);
        v1->addEdge(e);
        
		if(f->_edges){
            e->_nextFaceEdge = f->_edges;
            e->_prevFaceEdge = f->_edges->_prevFaceEdge;
            f->_edges->_prevFaceEdge->_nextFaceEdge = e;
            f->_edges->_prevFaceEdge = e;
        }else{
            e->_nextFaceEdge = e;
            e->_prevFaceEdge = e;
            f->_edges = e;
        }

        return e;
    }

private:
    template<class EB2, class FB2, class VB2>
    void linkCopiedOpposites(const HalfEdgeMesh<EB2, FB2, VB2>& o){
        for(std::size_t i = 0; i < faceCount(); ++i){
            Edge* fo = o.faces()[i]->edges();
            Edge* fc = _faces[i]->edges();
            if(!fo) continue;
            do{
                if(fo->oppositeEdge() && !fc->oppositeEdge()){
                    Face* oppF = face(fo->oppositeEdge()->face()->index());
                    for(Edge* oe = oppF->edges(); oe; oe = oe->nextFaceEdge()){
                        if(oe->vertex1() == fc->vertex2() && oe->vertex2() == fc->vertex1()){
                            fc->linkToOppositeEdge(oe);
                            break;
                        }
                    }
                }
                fo = fo->nextFaceEdge();
                fc = fc->nextFaceEdge();
            }while(fo != o.faces()[i]->edges());
        }
    }

	class InternalVertex : public Vertex{
    public:
        InternalVertex(const Point3& p, int idx) noexcept : Vertex(p, idx){}
    };

    class InternalEdge : public Edge{
    public:
        InternalEdge(Vertex* v2, Face* f) noexcept : Edge(v2, f){}
    };
    
	class InternalFace : public Face{
    public:
        InternalFace(int idx) noexcept : Face(idx){}
    };

    std::vector<Vertex*> _vertices;
    MemoryPool<InternalVertex> _vertexPool;
    MemoryPool<InternalEdge> _edgePool;
    std::vector<Face*> _faces;
    MemoryPool<InternalFace> _facePool;
};

}

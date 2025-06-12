#include <opendxa/structures/atoms/base_atom.hpp>
#include <iostream>

BaseAtom::BaseAtom() 
    : tag(0)
    , pos()
    , numNeighbors(0)
    , flags(0){
    for(int i = 0; i < MAX_ATOM_NEIGHBORS; i++){
        neighbors[i].pointer = nullptr;
    }
}

BaseAtom* BaseAtom::neighbor(int index) const{
    DISLOCATIONS_ASSERT_GLOBAL(index >= 0 && index < numNeighbors);
    return neighbors[index].pointer;
}

void BaseAtom::setNeighbor(int index, BaseAtom* atom){
    DISLOCATIONS_ASSERT_GLOBAL(index >= 0 && index < numNeighbors);
    neighbors[index].pointer = atom;
}

bool BaseAtom::hasNeighbor(const BaseAtom* other) const{
    if(!other) return false;
    
    for(int i = 0; i < numNeighbors; i++){
        if(neighbors[i].pointer == other){
            return true;
        }
    }
    return false;
}

bool BaseAtom::hasNeighborTag(int neighborTag) const{
    for(int i = 0; i < numNeighbors; i++){
        if(neighbors[i].pointer && neighbors[i].pointer->tag == neighborTag){
            return true;
        }
    }
    return false;
}

int BaseAtom::neighborIndex(const BaseAtom* neighbor) const{
    if(!neighbor){
        DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndex()", "Null neighbor pointer.");
        return -1;
    }
    
    for(int ni = 0; ni < numNeighbors; ni++){
        if(neighbors[ni].pointer == neighbor){
            return ni;
        }
    }
    
    DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndex()", "The given atom is not in the neighbor list.");
    return -1;
}

int BaseAtom::neighborIndexTag(int neighborTag) const{
    for(int ni = 0; ni < numNeighbors; ni++){
        if(neighbors[ni].pointer && neighbors[ni].pointer->tag == neighborTag){
            return ni;
        }
    }
    
    DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "BaseAtom::neighborIndexTag()", "The given atom is not in the neighbor list.");
    return -1;
}

void BaseAtom::addNeighbor(BaseAtom* neighbor){
    if(!neighbor){
        DISLOCATIONS_ASSERT_MSG_GLOBAL(false, "addNeighbor()", "Cannot add null neighbor.");
        return;
    }
    
    if(hasNeighbor(neighbor)){
        std::cout << "Warning: Atom " << tag << " already has neighbor: " << neighbor->tag << std::endl;
        DISLOCATIONS_ASSERT_GLOBAL(false);
        return;
    }
    
    DISLOCATIONS_ASSERT_MSG_GLOBAL(numNeighbors < MAX_ATOM_NEIGHBORS, "addNeighbor()", "Maximum number of nearest neighbors per atom was exceeded.");
    
    neighbors[numNeighbors++].pointer = neighbor;
}

void BaseAtom::clearNeighbors(){
    for(int i = 0; i < numNeighbors; i++){
        neighbors[i].pointer = nullptr;
    }
    numNeighbors = 0;
}

bool BaseAtom::isValidNeighborIndex(int index) const{
    return index >= 0 && index < numNeighbors;
}

void BaseAtom::removeNeighbor(const BaseAtom* neighbor){
    if(!neighbor) return;
    
    for(int i = 0; i < numNeighbors; i++){
        if(neighbors[i].pointer == neighbor){
            neighbors[i] = neighbors[numNeighbors - 1];
            neighbors[numNeighbors - 1].pointer = nullptr;
            numNeighbors--;
            return;
        }
    }
}

void BaseAtom::validateNeighbors() const{
    DISLOCATIONS_ASSERT_GLOBAL(numNeighbors >= 0 && numNeighbors <= MAX_ATOM_NEIGHBORS);
    
    for(int i = 0; i < numNeighbors; i++){
        DISLOCATIONS_ASSERT_GLOBAL(neighbors[i].pointer != nullptr);
        DISLOCATIONS_ASSERT_GLOBAL(neighbors[i].pointer != this);
    }
}
#pragma once

namespace OpenDXA{

enum StructureType{
    OTHER = 0,
    FCC,
    HCP,
    BCC,
    ICO,
    NUM_STRUCTURE_TYPES
};

enum CoordinationStructureType{
    COORD_OTHER = 0,
    COORD_FCC,
    COORD_HCP,
    COORD_BCC,
    COORD_CUBIC_DIAMOND,
    COORD_HEX_DIAMOND,
    NUM_COORD_TYPES 
};

enum LatticeStructureType{
    LATTICE_OTHER = 0,
    LATTICE_FCC,
    LATTICE_HCP,
    LATTICE_BCC,
    LATTICE_CUBIC_DIAMOND,
    LATTICE_HEX_DIAMOND,
    NUM_LATTICE_TYPES
};

enum { MAX_NEIGHBORS = 16 };

typedef unsigned int CNAPairBond;

}
#pragma once

namespace OpenDXA{

// Broad categories for crystal structures detected on an atom.
// Used to classify each atom's local arrangement into a known lattice
// type (e.g. FCC, BCC) or mark it as "OTHER" if it doesn't fit.
enum StructureType{
    OTHER = 0,
    SC,
    FCC,
    HCP,
    BCC,
    CUBIC_DIAMOND,
    HEX_DIAMOND,
    ICO,
    GRAPHENE,
    CUBIC_DIAMOND_FIRST_NEIGH,
    CUBIC_DIAMOND_SECOND_NEIGH,
    HEX_DIAMOND_FIRST_NEIGH,
    HEX_DIAMOND_SECOND_NEIGH,
    NUM_STRUCTURE_TYPES
};

// Detailed coordination patterns for common-neighbor analysis.
// Describes how each atom's neighbors connect to each other, allowing
// distinguishing subtly different packings, like FCC vs HCP, or diamond
// vs hexagonal diamond.
// TODO: CREATE A FUNCTION STRUCTURETYPE TO COORDINATION STRUCTURE TYPE
enum CoordinationStructureType{
    // No matching coordination pattern
    COORD_OTHER = 0,
    COORD_SC,
    // 12 neighbors in 4-2-1 ring pattern
    COORD_FCC,
    // 12 neighbors in 4-2-2 ring pattern
    COORD_HCP,
    // 14 neighbors in 6-6-6 vs 4-4-4 pattern
    COORD_BCC,
    // 4 + 12 neighbors with 5-4-3 rings
    COORD_CUBIC_DIAMOND,
    // 4 + 12 neighbors with 5-4-4 rings
    COORD_HEX_DIAMOND,
    NUM_COORD_TYPES 
};

// High level lattice types for polyhedral template matching
// Defines the ideal reference lattices that the PTM algorithm
// can detect such as FCC or hexagonal diamond
enum LatticeStructureType{
    LATTICE_OTHER = 0,
    LATTICE_SC,
    LATTICE_FCC,
    LATTICE_HCP,
    LATTICE_BCC,
    // (zinc blende without basis)
    LATTICE_CUBIC_DIAMOND,
    // (wurtzite-type)
    LATTICE_HEX_DIAMOND,
    NUM_LATTICE_TYPES
};

// Maximum number of nearest neighbors supported by CNA.
// this limit defines buffer sizes for neighbor lists and common-neighbor mask.
enum { MAX_NEIGHBORS = 16 };

// Bitmask type representing a bond between two common neighbors.
// Each bit in a CNAPairBond corresponds to one neighbor index;
// the union of two bits marks a neighbor-neighbor bond.
typedef unsigned int CNAPairBond;

}
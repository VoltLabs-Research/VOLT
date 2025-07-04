#ifndef PTM_MULTISHELL_H
#define PTM_MULTISHELL_H

#include <cstddef>

namespace ptm {

// For multishell structures, correspondence encoding doesn't allow a
// neighbour index higher than 13. A structure which needs a neighbour with an
// index higher than 13 is in any case not graphene or a diamond structure.
#define MAX_MULTISHELL_NEIGHBOURS 13

int calculate_two_shell_neighbour_ordering( int num_inner, int num_outer,
                        size_t atom_index, int (get_neighbours)(void* vdata, size_t _unused_lammps_variable, size_t atom_index, int num, ptm_atomicenv_t* env), void* nbrlist,
                        ptm_atomicenv_t* central_env, ptm_atomicenv_t* output);
}

#endif


#ifndef PTM_FUNCTIONS_H
#define PTM_FUNCTIONS_H

#include <stdint.h>
#include <stdbool.h>
#include "ptm_initialize_data.h"
#include "ptm_constants.h"


//------------------------------------
//    function declarations
//------------------------------------
int ptm_index(  ptm_local_handle_t local_handle,
                size_t atom_index, int (get_neighbours)(void* vdata, size_t _unused_lammps_variable, size_t atom_index, int num, ptm_atomicenv_t* env), void* nbrlist,
                int32_t flags, bool calculate_deformation, //inputs
                ptm_result_t* result, ptm_atomicenv_t* output_env); //outputs

int ptm_remap_template(int type, int input_template_index, double* qtarget, double* q, int8_t* mapping);

double ptm_map_and_calculate_disorientation(int type, double* qtarget, double* q);

int ptm_preorder_neighbours(void* _voronoi_handle, int num_input_points, double (*input_points)[3], uint64_t* res);

uint64_t ptm_encode_correspondences(int type, int num, int8_t* correspondences, int best_template_index);
void ptm_decode_correspondences(int type, uint64_t encoded, int8_t* correspondences, int* p_best_template_index);

#endif


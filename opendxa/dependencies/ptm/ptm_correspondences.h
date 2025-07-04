#ifndef PTM_CORRESPONDENCES_H
#define PTM_CORRESPONDENCES_H


#include <cstddef>
#include <cstdint>

namespace ptm {

void complete_correspondences(int n, int8_t* correspondences);
uint64_t encode_correspondences(int type, int num, int8_t* correspondences, int best_template_index);
void decode_correspondences(int type, uint64_t encoded, int8_t* correspondences, int* p_best_template_index);

}

#endif


#include "ptm_deformation_gradient.h"

namespace ptm {

void calculate_deformation_gradient(int num_points, int8_t* mapping, double (*normalized)[3], const double (*penrose)[3], double* F)
{
    for (int i = 0;i<3;i++)
    {
        for (int j = 0;j<3;j++)
        {
            double acc = 0.0;
            for (int k = 0;k<num_points;k++)
                acc += penrose[k][j] * normalized[mapping[k]][i];

            F[i*3 + j] = acc;
        }
    }
}

}


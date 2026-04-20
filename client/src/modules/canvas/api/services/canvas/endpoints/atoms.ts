import { get } from '@/app/core/http/utilities/create-service';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/dtos/trajectory';

interface AtomsApiResponse {
    status: 'success';
    data: GetAtomsOutputDTO['data'];
    pagination: GetAtomsOutputDTO['pagination'];
    _meta?: {
        properties: string[];
    };
};

export default {
    getAtoms: get<GetAtomsInputDTO, GetAtomsOutputDTO, AtomsApiResponse>('/:trajectoryId/atoms', {
        omit: ['trajectoryId', 'analysisId'],
        query: ({ timestep, page, limit, analysisId }) => ({
            timestep,
            ...(page !== undefined ? { page } : {}),
            ...(limit !== undefined ? { limit } : {}),
            ...(analysisId ? { analysisId } : {})
        }),
        unwrap: 'raw',
        map: (response) => ({
            status: 'success',
            data: response.data,
            pagination: response.pagination,
            _meta: {
                properties: response._meta?.properties || []
            }
        })
    })
};

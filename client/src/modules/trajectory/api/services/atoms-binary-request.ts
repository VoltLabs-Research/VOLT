import { decodeAtomsBinary } from '@/modules/trajectory/utilities/decode-atoms-binary';

import type { ServiceExecutionContext } from '@/app/core/http/utilities/create-service';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/dtos/trajectory';

export const getAtomsBinary = async (
    { getClient }: ServiceExecutionContext,
    params: GetAtomsInputDTO
): Promise<GetAtomsOutputDTO> => {
    const blob = await getClient().request<Blob>(
        'GET',
        `/${params.trajectoryId}/frame/${params.timestep}/atoms`,
        {
            query: {
                fmt: 'bin',
                ...(params.page !== undefined ? { page: params.page } : {}),
                ...(params.limit !== undefined ? { limit: params.limit } : {}),
                ...(params.analysisId ? { analysisId: params.analysisId } : {})
            },
            responseType: 'blob'
        }
    );

    return decodeAtomsBinary(await blob.arrayBuffer());
};

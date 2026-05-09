import { decodeAtomsBinary } from '@/modules/trajectory/utilities/decode-atoms-binary';

import type { ServiceExecutionContext } from '@voltstack/voltclient';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';

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

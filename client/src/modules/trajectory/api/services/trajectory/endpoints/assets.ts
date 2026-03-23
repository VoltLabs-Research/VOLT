import { custom, get } from '@/app/core/http/utilities/create-service';
import { base64ToBlob } from '@/shared/utils/file';
import type { VoltClient } from '@voltstack/voltclient';
import type {
    AtomData,
    DownloadTrajectoryInputDTO,
    GetAtomsInputDTO,
    GetAtomsOutputDTO,
    GetPreviewInputDTO,
    GetPreviewOutputDTO
} from '../../../dtos/trajectory';

interface AtomsApiResponse {
    status: 'success';
    data: AtomData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
    _meta?: {
        properties: string[];
    };
};

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

export default {
    getPreview: get<GetPreviewInputDTO, GetPreviewOutputDTO, string>('/:trajectoryId/preview', {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    download: custom<DownloadTrajectoryInputDTO, Blob>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            query: {
                ...(params.filename ? { name: params.filename } : {}),
                ...(params.archive !== undefined ? { archive: params.archive } : {})
            },
            responseType: 'blob',
            timeoutMs: 0
        };

        return getClient().request('GET', `/${params.trajectoryId}/download`, requestArgs);
    }),
    getAtoms: get<GetAtomsInputDTO, GetAtomsOutputDTO, AtomsApiResponse>(
        '/:trajectoryId/atoms',
        {
            omit: ['trajectoryId', 'analysisId'],
            query: ({ timestep, page, limit, analysisId }) => ({
                timestep,
                ...(page !== undefined ? { page } : {}),
                ...(limit !== undefined ? { limit } : {}),
                ...(analysisId ? { analysisId } : {})
            }),
            unwrap: 'raw',
            map: (response) => {
                return {
                    status: 'success',
                    data: response.data,
                    pagination: response.pagination,
                    _meta: {
                        properties: response._meta?.properties || []
                    }
                };
            }
        }
    )
};

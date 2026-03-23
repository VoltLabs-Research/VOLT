import { get, download } from '@/app/core/http/utilities/create-service';
import { base64ToBlob } from '@/shared/utils/file';
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

export default {
    getPreview: get<GetPreviewInputDTO, GetPreviewOutputDTO, string>('/:trajectoryId/preview', {
        query: ({ frame, quality }) => ({
            ...(frame !== undefined ? { frame } : {}),
            ...(quality ? { quality } : {})
        }),
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    download: download<DownloadTrajectoryInputDTO>('GET', '/:trajectoryId/download', {
        query: ({ filename, archive }) => ({
            ...(filename ? { name: filename } : {}),
            ...(archive !== undefined ? { archive } : {})
        })
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

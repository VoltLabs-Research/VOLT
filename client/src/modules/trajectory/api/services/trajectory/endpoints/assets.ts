import { get, download } from '@/app/core/http/utilities/create-service';
import { base64ToBlob } from '@/shared/utils/file';
import type { GetPreviewInputDTO, GetPreviewOutputDTO } from '../../../dtos/get-preview';
import type { DownloadTrajectoryInputDTO } from '../../../dtos/download-trajectory';
import type { GetAtomsInputDTO, GetAtomsOutputDTO } from '../../../dtos/get-atoms';

interface AtomsApiResponse {
    status: 'success';
    data: any[];
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
}

const endpoints = {
    getPreview: get<GetPreviewInputDTO, GetPreviewOutputDTO>('/:trajectoryId/preview', {
        omit: ['version'],
        map: (result) => ({ blob: base64ToBlob(result as string) })
    }),
    download: download<DownloadTrajectoryInputDTO>('GET', '/:trajectoryId/download', {
        query: ({ filename }) => filename ? { name: filename } : {}
    }),
    getAtoms: get<GetAtomsInputDTO, GetAtomsOutputDTO>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/atoms/${analysisId}`
            : `/${trajectoryId}/atoms`,
        {
            omit: ['trajectoryId', 'analysisId'],
            unwrap: 'raw',
            map: (result) => {
                const response = result as AtomsApiResponse;

                return {
                    status: 'success' as const,
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

export default endpoints;

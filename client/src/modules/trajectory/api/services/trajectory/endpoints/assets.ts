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
        omit: ['version'],
        map: (result) => ({ blob: base64ToBlob(result) })
    }),
    download: download<DownloadTrajectoryInputDTO>('GET', '/:trajectoryId/download', {
        query: ({ filename }) => filename ? { name: filename } : {}
    }),
    getAtoms: get<GetAtomsInputDTO, GetAtomsOutputDTO, AtomsApiResponse>(
        ({ trajectoryId, analysisId }) => analysisId
            ? `/${trajectoryId}/atoms/${analysisId}`
            : `/${trajectoryId}/atoms`,
        {
            omit: ['trajectoryId', 'analysisId'],
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

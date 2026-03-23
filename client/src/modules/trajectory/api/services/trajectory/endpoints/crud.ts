import { custom, paginated, get, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { VoltClient } from '@voltstack/voltclient';
import type { Trajectory } from '../../../entities/trajectory';
import type {
    CreateTrajectoryInputDTO,
    CreateTrajectoryOutputDTO,
    DeleteTrajectoryInputDTO,
    GetTrajectoriesInputDTO,
    UpdateTrajectoryInputDTO
} from '../../../dtos/trajectory';

interface GetTrajectoryByIdParams {
    trajectoryId: string;
};

const MULTIPART_FORM_HEADERS: Record<string, string> = {
    'Content-Type': 'multipart/form-data'
};

type RequestArgsWithTimeout = NonNullable<Parameters<VoltClient['request']>[2]> & {
    timeoutMs: number;
};

interface CreateTrajectoryApiResponse {
    status: 'success';
    data: Trajectory;
};

export default {
    getAll: paginated<GetTrajectoriesInputDTO, PaginatedResponse<Trajectory>>('/'),
    getById: get<GetTrajectoryByIdParams, Trajectory>('/:trajectoryId'),
    create: custom<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO>(async ({ getClient }, params) => {
        const requestArgs: RequestArgsWithTimeout = {
            body: params.formData,
            headers: MULTIPART_FORM_HEADERS,
            onUploadProgress: params.onProgress
                ? (e) => {
                    if (e.total) {
                        params.onProgress?.(e.loaded / e.total);
                    }
                }
                : undefined,
            timeoutMs: 0
        };

        const response = await getClient().request<CreateTrajectoryApiResponse>('POST', '/', requestArgs);
        return response.data;
    }),
    update: patch<UpdateTrajectoryInputDTO, Trajectory>('/:trajectoryId'),
    delete: del<DeleteTrajectoryInputDTO>('/:trajectoryId'),
    move: patch<{ trajectoryId: string; folderId: string | null }, void>('/:trajectoryId/folder', {
        body: ({ folderId }) => ({ folderId })
    })
};

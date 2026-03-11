import { paginated, get, patch, del, request } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
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

export default {
    getAll: paginated<GetTrajectoriesInputDTO, PaginatedResponse<Trajectory>>('/'),
    getById: get<GetTrajectoryByIdParams, Trajectory>('/:trajectoryId'),
    create: request<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO, Trajectory>('POST', '/', {
        omit: ['formData', 'onProgress'],
        body: ({ formData }) => formData,
        headers: MULTIPART_FORM_HEADERS,
        onUploadProgress: ({ onProgress }) => onProgress
            ? (e) => {
                if (e.total) {
                    onProgress(e.loaded / e.total);
                }
            }
            : undefined,
        map: (trajectory) => trajectory
    }),
    update: patch<UpdateTrajectoryInputDTO, Trajectory>('/:trajectoryId'),
    delete: del<DeleteTrajectoryInputDTO>('/:trajectoryId'),
    move: patch<{ trajectoryId: string; folderId: string | null }, void>('/:trajectoryId/folder', {
        body: ({ folderId }) => ({ folderId })
    })
};

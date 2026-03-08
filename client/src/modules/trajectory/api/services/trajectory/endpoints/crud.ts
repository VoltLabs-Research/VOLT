import { paginated, get, patch, del, request } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Trajectory } from '../../../entities/trajectory';
import type { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '../../../dtos/create-trajectory';
import type { GetTrajectoriesInputDTO } from '../../../dtos/get-trajectories';
import type { UpdateTrajectoryInputDTO } from '../../../dtos/update-trajectory';
import type { DeleteTrajectoryInputDTO } from '../../../dtos/delete-trajectory';

const endpoints = {
    getAll: paginated<GetTrajectoriesInputDTO, PaginatedResponse<Trajectory>>('/'),
    getById: get<{ trajectoryId: string }, Trajectory>('/:trajectoryId'),
    create: request<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO>('POST', '/', {
        body: ({ formData }) => formData,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: ({ onProgress }) => onProgress
            ? (e) => {
                if (e.total) {
                    onProgress(e.loaded / e.total);
                }
            }
            : undefined,
        map: (result) => ({ trajectory: result as Trajectory })
    }),
    update: patch<UpdateTrajectoryInputDTO, Trajectory>('/:_id'),
    delete: del<DeleteTrajectoryInputDTO>('/:_id')
};

export default endpoints;

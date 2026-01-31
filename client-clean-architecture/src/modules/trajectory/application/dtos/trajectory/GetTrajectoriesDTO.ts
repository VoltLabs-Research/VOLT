import type { Trajectory } from '../../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

interface GetTrajectoriesInputDTO {
    page: number;
    limit: number;
    search?: string;
};

type GetTrajectoriesOutputDTO = PaginatedResponse<Trajectory>;

export type { GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO };


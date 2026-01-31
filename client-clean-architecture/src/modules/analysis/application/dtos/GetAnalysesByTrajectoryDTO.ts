import type { Analysis } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetAnalysesByTrajectoryInputDTO {
    trajectoryId: string;
    page: number;
    limit: number;
};

export type GetAnalysesByTrajectoryOutputDTO = PaginatedResponse<Analysis>;

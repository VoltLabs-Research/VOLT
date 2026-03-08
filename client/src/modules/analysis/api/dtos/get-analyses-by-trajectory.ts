import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '../entities/analysis';

export interface GetAnalysesByTrajectoryParams {
    trajectoryId: string;
    page: number;
    limit: number;
};

export type GetAnalysesByTrajectoryResponse = PaginatedResponse<Analysis>;

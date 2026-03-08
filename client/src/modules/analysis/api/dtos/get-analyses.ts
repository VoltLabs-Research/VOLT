import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { Analysis } from '../entities/analysis';

export interface GetAnalysesParams {
    page: number;
    limit: number;
};

export type GetAnalysesResponse = PaginatedResponse<Analysis>;
